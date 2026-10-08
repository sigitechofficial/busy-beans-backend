/**
 * Invoice pay links. The "Pay now" link in invoice emails carries a random code per invoice
 * (orders.payToken / partnerOrders.payToken): whoever has the link can pay without logging in and
 * may forward it (e.g. to their accounts team), but an order number alone no longer opens anyone's
 * payment page.
 *
 *   https://<site>/paymentCheck?orderId=1234&orderType=customer&t=<payToken>
 *
 * Every invoice that existed before codes (payLinkLegacy = 1: emails, PDFs, copied links) keeps
 * working without a code. Leave PAY_LINK_LEGACY_UNTIL unset (= forever); setting an ISO date ends
 * that. PAY_LINK_BASE_URL is the website that hosts /paymentCheck (default
 * https://busybeancoffee.com, as before).
 */
const crypto = require("crypto");

const DEFAULT_BASE = "https://busybeancoffee.com";
let warnedLegacy = false;

const newPayToken = () => crypto.randomBytes(24).toString("base64url");

/** The invoice's pay code, created on first use (concurrent callers end up with the same code). */
async function ensurePayToken(Model, id) {
  const row = await Model.findOne({ where: { id }, attributes: ["id", "payToken"], raw: true });
  if (!row) return null;
  if (row.payToken) return row.payToken;
  await Model.update({ payToken: newPayToken() }, { where: { id, payToken: null } });
  const again = await Model.findOne({ where: { id }, attributes: ["payToken"], raw: true });
  return again?.payToken || null;
}

function payTokenMatches(row, given) {
  if (!row?.payToken || typeof given !== "string" || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(String(row.payToken));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Old email link without a code, still inside the transition period. */
function legacyLinkAllowed(row) {
  if (!row?.payLinkLegacy) return false;
  const until = process.env.PAY_LINK_LEGACY_UNTIL;
  if (!until) {
    if (!warnedLegacy) {
      warnedLegacy = true;
      console.warn("[pay-link] PAY_LINK_LEGACY_UNTIL is not set: invoice links emailed before pay codes keep working without a code.");
    }
    return true;
  }
  const cutoff = new Date(until);
  return Number.isNaN(cutoff.getTime()) ? false : Date.now() < cutoff.getTime();
}

function payUrl({ id, orderType = "customer", payToken }) {
  const base = String(process.env.PAY_LINK_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  const params = new URLSearchParams({ orderId: String(id), orderType });
  if (payToken) params.set("t", payToken);
  return `${base}/paymentCheck?${params.toString()}`;
}

/**
 * Pay link for an invoice (email "Pay now" and the PDF's "Pay Online"), with its pay code.
 * `data`: order details ({ id, orderOf: "customer" | "local-partner" }). If the code can't be
 * created the link has none, which still works for invoices from before pay codes.
 */
async function invoicePayUrl(data) {
  if (!data?.id) return null;
  const orderType = data.orderOf || "customer";
  // eslint-disable-next-line global-require
  const { order, partnerOrder } = require("../models");
  const payToken = await ensurePayToken(orderType === "local-partner" ? partnerOrder : order, data.id).catch((error) => {
    console.error("[pay-link] pay code not created:", error.message);
    return null;
  });
  return payUrl({ id: data.id, orderType, payToken });
}

module.exports = {
  invoicePayUrl,
  newPayToken,
  ensurePayToken,
  payTokenMatches,
  legacyLinkAllowed,
  payUrl,
};
