const catchAsync = require("../../utils/catchAsync");
const { submitLead } = require("../services/leadSubmissions.service");
const { sendData, sendError } = require("../utils/httpResponses");
const { clientIp } = require("../utils/requestMeta");

exports.create = catchAsync(async (req, res) => {
  try {
    const data = await submitLead(req.body || {}, {
      ip: clientIp(req),
      userAgent: req.headers["user-agent"],
      // Campaign Builder session → test lead (decided here, never by the body).
      authorization: req.headers.authorization,
    });
    return sendData(res, 200, data);
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      return sendError(res, 400, error.message, "VALIDATION_ERROR");
    }
    return sendError(res, 500, "Failed to submit lead.", "INTERNAL_ERROR");
  }
});
