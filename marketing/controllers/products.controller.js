const catchAsync = require("../../utils/catchAsync");
const productsService = require("../services/products.service");
const { sendData, sendError } = require("../utils/httpResponses");

exports.list = catchAsync(async (_req, res) => {
  const data = await productsService.listProducts();
  return sendData(res, 200, data);
});

exports.getById = catchAsync(async (req, res) => {
  const row = await productsService.getProductById(req.params.id);
  if (!row) return sendError(res, 404, "Product not found.", "NOT_FOUND");
  return sendData(res, 200, row);
});

exports.create = catchAsync(async (req, res) => {
  const row = await productsService.createProduct(req.body || {});
  return sendData(res, 201, row);
});

exports.update = catchAsync(async (req, res) => {
  const row = await productsService.updateProduct(req.params.id, req.body || {});
  if (!row) return sendError(res, 404, "Product not found.", "NOT_FOUND");
  return sendData(res, 200, row);
});

exports.archive = catchAsync(async (req, res) => {
  const row = await productsService.archiveProduct(req.params.id);
  if (!row) return sendError(res, 404, "Product not found.", "NOT_FOUND");
  return sendData(res, 200, row);
});

exports.remove = catchAsync(async (req, res) => {
  const result = await productsService.deleteProduct(req.params.id);
  if (!result.deleted && result.reason === "NOT_FOUND") {
    return sendError(res, 404, "Product not found.", "NOT_FOUND");
  }
  if (!result.deleted && result.reason === "IN_USE") {
    return sendError(
      res,
      409,
      "Product is linked to campaigns and cannot be deleted.",
      "PRODUCT_IN_USE",
      { campaignCount: result.campaignCount },
    );
  }
  return res.status(204).send();
});
