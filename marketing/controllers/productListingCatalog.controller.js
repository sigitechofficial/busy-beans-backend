const catchAsync = require("../../utils/catchAsync");
const productListingCatalogService = require("../services/productListingCatalog.service");
const { sendData, sendError } = require("../utils/httpResponses");

exports.list = catchAsync(async (_req, res) => {
  const data = await productListingCatalogService.listOverrides();
  return sendData(res, 200, data);
});

exports.upsert = catchAsync(async (req, res) => {
  const data = await productListingCatalogService.upsertOverride(
    req.params.listingType,
    req.body || {},
  );
  return sendData(res, 200, data);
});

exports.remove = catchAsync(async (req, res) => {
  const deleted = await productListingCatalogService.deleteOverride(req.params.listingType);
  if (!deleted) return sendError(res, 404, "Override not found.", "NOT_FOUND");
  return res.status(204).send();
});
