const catchAsync = require("../../utils/catchAsync");
const touchpointsService = require("../services/touchpoints.service");
const { sendError } = require("../utils/httpResponses");

exports.createTouchpoint = catchAsync(async (req, res) => {
  try {
    await touchpointsService.ingestTouchpoint(req.body || {});
    return res.status(204).send();
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      return sendError(res, 400, error.message, "VALIDATION_ERROR");
    }
    return sendError(res, 500, "Failed to ingest touchpoint.", "INTERNAL_ERROR");
  }
});
