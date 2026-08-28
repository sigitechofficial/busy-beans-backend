const catchAsync = require("../../utils/catchAsync");
const campaignsService = require("../services/campaigns.service");
const { sendData, sendError } = require("../utils/httpResponses");

exports.list = catchAsync(async (_req, res) => {
  const data = await campaignsService.listCampaigns();
  return sendData(res, 200, data);
});

exports.getById = catchAsync(async (req, res) => {
  const row = await campaignsService.getCampaignById(req.params.id);
  if (!row) return sendError(res, 404, "Campaign not found.", "NOT_FOUND");
  return sendData(res, 200, row);
});

exports.create = catchAsync(async (req, res) => {
  const row = await campaignsService.createCampaign(req.body || {});
  return sendData(res, 201, row);
});

exports.update = catchAsync(async (req, res) => {
  const row = await campaignsService.updateCampaign(req.params.id, req.body || {});
  if (!row) return sendError(res, 404, "Campaign not found.", "NOT_FOUND");
  return sendData(res, 200, row);
});

exports.archive = catchAsync(async (req, res) => {
  const row = await campaignsService.archiveCampaign(req.params.id);
  if (!row) return sendError(res, 404, "Campaign not found.", "NOT_FOUND");
  return sendData(res, 200, row);
});

exports.remove = catchAsync(async (req, res) => {
  const result = await campaignsService.deleteCampaign(req.params.id);
  if (!result.deleted && result.reason === "NOT_FOUND") {
    return sendError(res, 404, "Campaign not found.", "NOT_FOUND");
  }
  return res.status(204).send();
});
