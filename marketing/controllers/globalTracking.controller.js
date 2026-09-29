const catchAsync = require("../../utils/catchAsync");
const globalTrackingService = require("../services/globalTracking.service");
const { sendData, sendError } = require("../utils/httpResponses");
const { scriptsChanged } = require("../utils/trackingSettings");
const { isSuperAdmin } = require("../middlewares/customHtmlGuard");

exports.getSettings = catchAsync(async (_req, res) => {
  const data = await globalTrackingService.getTrackingSettings();
  return sendData(res, 200, data);
});

exports.updateSettings = catchAsync(async (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return sendError(res, 400, "Tracking settings body is required.", "VALIDATION_ERROR");
  }
  const settings = req.body?.settings || req.body;
  // Custom scripts run on every website page: Super Admins only (tag IDs are validated instead).
  const current = await globalTrackingService.getTrackingSettings();
  if (scriptsChanged(current.settings, settings) && !(await isSuperAdmin(req))) {
    return sendError(res, 403, "Only Super Admins can change custom tracking scripts.", "SCRIPTS_FORBIDDEN");
  }
  try {
    const data = await globalTrackingService.updateTrackingSettings(settings, req.marketingUser);
    return sendData(res, 200, data);
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      return sendError(res, 400, error.message, "VALIDATION_ERROR", { field: error.field });
    }
    throw error;
  }
});

/** GET /api/public/tracking/settings — tag IDs + scripts the website loads (public by nature). */
exports.getPublicSettings = catchAsync(async (_req, res) => {
  const data = await globalTrackingService.getPublicTrackingSettings();
  res.set("Cache-Control", "public, max-age=60");
  return sendData(res, 200, data);
});
