const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const {
  syncUnsyncedPaidCustomerOrderPayments,
  parseBool,
  DEFAULT_LIMIT,
} = require("../../services/qboUnsyncedPaidPaymentSyncService");

/**
 * Optional shared secret for Lambda / cron callers.
 * If LAMBDA_JOB_SECRET is set in env, request must include matching
 * header x-job-secret or body.jobSecret. If unset, endpoint stays open
 * like other existing lambda-function routes.
 */
function assertJobSecret(req) {
  const expected = process.env.LAMBDA_JOB_SECRET;
  if (!expected) return;
  const provided =
    req.headers["x-job-secret"] ||
    req.body?.jobSecret ||
    req.query?.jobSecret;
  if (!provided || provided !== expected) {
    throw new AppError("Unauthorized job request", 401);
  }
}

/**
 * POST /api/v1/admin/lambda-function/sync-unsynced-paid-customer-payments
 *
 * Paid customer orders only. Per order:
 * - with salesRepId  → sync partner invoice if missing, then partner payment
 * - without salesRep → sync admin invoice if missing, then admin payment
 *
 * Body/query (optional):
 * - dryRun: boolean (default false) — return candidates + planned actions only
 * - limit: number (default 10, max 10)
 * - syncSide: "admin" | "partner" | "both" (default "both") — filter path
 */
exports.syncUnsyncedPaidCustomerPayments = catchAsync(async (req, res) => {
  assertJobSecret(req);

  const dryRun = parseBool(
    req.body?.dryRun ?? req.query?.dryRun,
    false,
  );
  const limitRaw = req.body?.limit ?? req.query?.limit;
  const limit =
    limitRaw === undefined || limitRaw === null || limitRaw === ""
      ? DEFAULT_LIMIT
      : Number(limitRaw);
  const syncSideRaw =
    req.body?.syncSide || req.query?.syncSide || "both";
  const syncSide = String(syncSideRaw).toLowerCase();
  if (!["admin", "partner", "both"].includes(syncSide)) {
    throw new AppError(
      `Invalid syncSide "${syncSideRaw}". Expected admin, partner, or both.`,
      400,
    );
  }

  const summary = await syncUnsyncedPaidCustomerOrderPayments({
    dryRun,
    limit,
    syncSide,
  });

  const hasFailures = (summary.failureCount || 0) > 0;
  const hasPartials = (summary.partialCount || 0) > 0;

  let status = "success";
  let message =
    summary.message ||
    "Unsynced paid customer invoice/payment sync processed";

  if (summary.dryRun) {
    status = "success";
    message = summary.message;
  } else if (summary.skipped && summary.candidateCount === 0) {
    status = "success";
    message = summary.message;
  } else if (hasFailures && (summary.successCount || 0) === 0 && !hasPartials) {
    status = "failed";
    message = summary.message || "All invoice/payment syncs failed";
  } else if (hasFailures || hasPartials) {
    status = "partial-success";
    message =
      summary.message ||
      "Invoice/payment sync completed with some failures or partial results";
  }

  return res.status(200).json({
    status,
    message,
    data: summary,
  });
});
