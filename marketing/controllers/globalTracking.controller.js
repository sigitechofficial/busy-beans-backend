const catchAsync = require("../../utils/catchAsync");
const globalTrackingService = require("../services/globalTracking.service");
const { sendData, sendError } = require("../utils/httpResponses");

exports.getSettings = catchAsync(async (_req, res) => {
  const data = await globalTrackingService.getTrackingSettings();
  return sendData(res, 200, data);
});

exports.updateSettings = catchAsync(async (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return sendError(res, 400, "Tracking settings body is required.", "VALIDATION_ERROR");
  }
  const settings = req.body?.settings || req.body;
  const data = await globalTrackingService.updateTrackingSettings(settings, req.marketingUser);
  return sendData(res, 200, data);
});
