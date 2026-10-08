/**
 * Who may open an invoice's payment (Stripe checkout / payment intent):
 *   - whoever has the invoice's pay link (code `t`, utils/payLink.js) — no login needed, shareable
 *   - the signed-in customer who owns the order, HQ staff, or the order's local partner
 *   - internal jobs with the job key (x-job-key)
 *   - old links without a code (payLinkLegacy: every invoice that existed before pay codes)
 * An already-paid invoice always answers "already paid" (as before, nothing else is shown), so an
 * old link to a paid invoice never looks broken. Anything else answers 404, so order numbers can't
 * be probed. Emergency switch: PAY_LINK_REQUIRE_CODE=false opens every invoice by number again.
 */
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { order, partnerOrder } = require("../models");
const { protect } = require("./protect");
const { canActForOrder } = require("./customerAccess");
const { payTokenMatches, legacyLinkAllowed } = require("../utils/payLink");

function jobKeyValid(req) {
  const expected = process.env.INTERNAL_JOB_API_KEY;
  const given = req.headers["x-job-key"];
  if (!expected || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Emergency switch (env, no redeploy): PAY_LINK_REQUIRE_CODE=false lets any invoice open by number. */
const codeOptional = () => String(process.env.PAY_LINK_REQUIRE_CODE || "").trim().toLowerCase() === "false";

const hasBearer = (req) => typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ");

/**
 * Slows down anyone trying order numbers or codes. Only failed attempts count (4xx / 5xx), so
 * customers opening valid links are never blocked, even many behind one office / proxy IP.
 */
const payLinkLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.PAY_LINK_RATE_LIMIT_MAX || 60),
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "fail", message: "Too many requests. Please try again in a few minutes." },
});

const invoicePayAccess = (param = "orderId") =>
  catchAsync(async (req, res, next) => {
    if (jobKeyValid(req)) return next();
    // Optional sign-in: a signed-in owner may skip the code. An expired / invalid login is ignored
    // (treated as a guest), so a stale browser session never blocks paying with the link.
    if (!req.user && hasBearer(req)) {
      await new Promise((resolve) =>
        protect(req, res, (error) => {
          if (error) req.user = undefined;
          resolve();
        }),
      );
    }
    const orderType = req.body?.orderType || req.query?.orderType || "customer";
    const isPartnerOrder = orderType === "local-partner";
    const Model = isPartnerOrder ? partnerOrder : order;
    const row = await Model.findOne({
      where: { id: req.params[param] },
      attributes: isPartnerOrder
        ? ["id", "salesRepId", "payToken", "payLinkLegacy", "paymentStatus", "paymentIntentId"]
        : ["id", "userId", "salesRepId", "payToken", "payLinkLegacy", "paymentStatus", "paymentIntentId"],
      raw: true,
    });
    const code = req.body?.t ?? req.query?.t;
    const ownerOrCode = row && (canActForOrder(req.user, row, { partnerOrder: isPartnerOrder }) || payTokenMatches(row, code));
    if (ownerOrCode) return next();
    if (row && legacyLinkAllowed(row)) {
      console.info(`[pay-link] old link used: ${orderType} order ${row.id}`);
      return next();
    }
    if (row && codeOptional()) {
      console.warn(`[pay-link] PAY_LINK_REQUIRE_CODE=false: ${orderType} order ${row.id} opened without its code`);
      return next();
    }
    if (row && (row.paymentStatus === "done" || row.paymentIntentId)) {
      return res.status(200).json({ status: "already-paid", message: "This invoice has already been paid.", data: {} });
    }
    return next(new AppError("Invoice not found", 404));
  });

module.exports = { invoicePayAccess, payLinkLimiter };
