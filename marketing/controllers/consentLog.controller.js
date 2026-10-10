const catchAsync = require("../../utils/catchAsync");
const consentLogService = require("../services/consentLog.service");
const { rangeFromQuery } = require("../utils/reportQuery");
const { clientIp, anonymizeIp } = require("../utils/requestMeta");
const { sendData, sendError } = require("../utils/httpResponses");

/** POST /api/public/tracking/consent — one choice saved in the website's cookie banner. */
exports.record = catchAsync(async (req, res) => {
  try {
    await consentLogService.recordConsent(req.body, {
      ipAnonymized: anonymizeIp(clientIp(req)),
      userAgent: req.get("user-agent"),
    });
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      return sendError(res, 400, error.message, "VALIDATION_ERROR", { field: error.field });
    }
    throw error;
  }
  return res.status(204).end();
});

/** GET /api/admin/analytics/consent?from=YYYY-MM-DD&to=YYYY-MM-DD — choice counts and rates. */
exports.summary = catchAsync(async (req, res) => {
  const range = rangeFromQuery(req.query || {}, { defaultPreset: null });
  const data = await consentLogService.getConsentSummary(range);
  return sendData(res, 200, { ...data, retentionDays: consentLogService.retentionDays() });
});

/** GET /api/admin/analytics/consent/:consentId — every choice saved by one browser (proof). */
exports.lookup = catchAsync(async (req, res) => {
  try {
    const records = await consentLogService.findConsentRecords(String(req.params.consentId || ""));
    return sendData(res, 200, { records });
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") return sendError(res, 400, error.message, "VALIDATION_ERROR");
    throw error;
  }
});
