const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const {
  sendAllDailyEodDigests,
  getBusinessDate,
} = require("../../services/dailyEodDigestService");

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
 * POST /api/v1/admin/lambda-function/send-daily-eod-digests
 *
 * Body/query (optional):
 * - reportDate: YYYY-MM-DD (defaults to today in America/New_York)
 * - forceRetryFailed: boolean (default true) — retry only previously failed slots
 */
exports.sendDailyEodDigests = catchAsync(async (req, res) => {
  assertJobSecret(req);

  const reportDate =
    req.body?.reportDate || req.query?.reportDate || getBusinessDate();

  const forceRetryFailedRaw =
    req.body?.forceRetryFailed ?? req.query?.forceRetryFailed;
  const forceRetryFailed =
    forceRetryFailedRaw === undefined
      ? true
      : String(forceRetryFailedRaw) !== "false" && forceRetryFailedRaw !== false;

  const summary = await sendAllDailyEodDigests({
    reportDate,
    forceRetryFailed,
  });

  const hasFailures =
    summary.admin?.status === "failed" ||
    (summary.partners?.failed || 0) > 0;

  return res.status(200).json({
    status: hasFailures ? "partial-success" : "success",
    message: hasFailures
      ? "Daily EOD digests completed with some failures"
      : "Daily EOD digests processed",
    data: summary,
  });
});
