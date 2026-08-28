const catchAsync = require("../../utils/catchAsync");
const seedStatusService = require("../services/seedStatus.service");
const { sendData, sendError } = require("../utils/httpResponses");

exports.getStatus = catchAsync(async (_req, res) => {
  const data = await seedStatusService.getSeedStatus();
  return sendData(res, 200, data);
});

exports.patchStatus = catchAsync(async (req, res) => {
  const moduleKey = req.body?.module;
  if (!moduleKey) {
    return sendError(res, 400, "module is required.", "VALIDATION_ERROR");
  }

  try {
    const data = await seedStatusService.patchSeedStatus(
      moduleKey,
      req.body || {},
      req.marketingUser,
    );
    return sendData(res, 200, data);
  } catch (error) {
    if (error.code === "INVALID_MODULE" || error.code === "VALIDATION_ERROR") {
      return sendError(res, 400, error.message, error.code);
    }
    throw error;
  }
});
