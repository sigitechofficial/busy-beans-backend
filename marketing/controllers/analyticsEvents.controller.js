const catchAsync = require("../../utils/catchAsync");
const analyticsEventsService = require("../services/analyticsEvents.service");
const { sendError } = require("../utils/httpResponses");

exports.createEvent = catchAsync(async (req, res) => {
  try {
    await analyticsEventsService.ingestEvent(req.body || {});
    return res.status(204).send();
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      return sendError(res, 400, error.message, "VALIDATION_ERROR");
    }
    return sendError(res, 500, "Failed to ingest event.", "INTERNAL_ERROR");
  }
});
