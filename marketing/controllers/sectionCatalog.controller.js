const catchAsync = require("../../utils/catchAsync");
const sectionCatalogService = require("../services/sectionCatalog.service");
const { sendData, sendError } = require("../utils/httpResponses");

exports.list = catchAsync(async (_req, res) => {
  const data = await sectionCatalogService.listOverrides();
  return sendData(res, 200, data);
});

exports.upsert = catchAsync(async (req, res) => {
  const data = await sectionCatalogService.upsertOverride(
    req.params.sectionType,
    req.body || {},
  );
  return sendData(res, 200, data);
});

exports.patchActive = catchAsync(async (req, res) => {
  const active = req.body?.active !== undefined ? req.body.active : true;
  const data = await sectionCatalogService.setOverrideActive(req.params.sectionType, active);
  return sendData(res, 200, data);
});

exports.remove = catchAsync(async (req, res) => {
  const deleted = await sectionCatalogService.deleteOverride(req.params.sectionType);
  if (!deleted) return sendError(res, 404, "Override not found.", "NOT_FOUND");
  return res.status(204).send();
});
