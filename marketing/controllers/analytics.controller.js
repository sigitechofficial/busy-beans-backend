const catchAsync = require("../../utils/catchAsync");
const analyticsDashboardService = require("../services/analyticsDashboard.service");
const { sendData } = require("../utils/httpResponses");

exports.dashboard = catchAsync(async (req, res) => {
  const data = await analyticsDashboardService.getDashboard(req.query || {});
  return sendData(res, 200, data);
});
