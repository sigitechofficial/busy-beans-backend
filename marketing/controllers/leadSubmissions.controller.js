const catchAsync = require("../../utils/catchAsync");
const { submitLead } = require("../services/leadSubmissions.service");
const { sendData, sendError } = require("../utils/httpResponses");

exports.create = catchAsync(async (req, res) => {
  try {
    const data = await submitLead(req.body || {});
    return sendData(res, 200, data);
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      return sendError(res, 400, error.message, "VALIDATION_ERROR");
    }
    return sendError(res, 500, "Failed to submit lead.", "INTERNAL_ERROR");
  }
});
