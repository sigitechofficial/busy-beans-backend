const catchAsync = require("../../utils/catchAsync");
const mediaService = require("../services/media.service");
const { sendData, sendError } = require("../utils/httpResponses");

function handleError(res, error) {
  if (error.code === "VALIDATION_ERROR") {
    return sendError(res, 400, error.message, error.code);
  }
  if (error.code === "FILE_TOO_LARGE") {
    return sendError(res, 413, error.message, error.code);
  }
  if (error.code === "UNSUPPORTED_MIME") {
    return sendError(res, 400, error.message, error.code);
  }
  return sendError(res, 500, "Failed to process media.", "INTERNAL_ERROR");
}

exports.list = catchAsync(async (_req, res) => {
  const data = await mediaService.listMediaAssets();
  return sendData(res, 200, data);
});

exports.create = catchAsync(async (req, res) => {
  try {
    const data = await mediaService.createMediaAsset(req.file, req.body || {});
    return sendData(res, 201, data);
  } catch (error) {
    return handleError(res, error);
  }
});

exports.updateMeta = catchAsync(async (req, res) => {
  const row = await mediaService.updateMediaMeta(req.params.id, req.body || {});
  if (!row) {
    return sendError(res, 404, "Media not found.", "NOT_FOUND");
  }
  return sendData(res, 200, {
    id: row.id,
    name: row.name,
    type: row.type,
    altText: row.altText || "",
    url: row.url,
    approved: Boolean(row.approved),
  });
});

exports.replaceFile = catchAsync(async (req, res) => {
  try {
    const row = await mediaService.replaceMediaFile(req.params.id, req.file);
    if (!row) {
      return sendError(res, 404, "Media not found.", "NOT_FOUND");
    }
    return sendData(res, 200, {
      id: row.id,
      name: row.name,
      type: row.type,
      altText: row.altText || "",
      url: row.url,
      approved: Boolean(row.approved),
    });
  } catch (error) {
    return handleError(res, error);
  }
});

exports.remove = catchAsync(async (req, res) => {
  const force = String(req.query.force || "").toLowerCase() === "true";
  const result = await mediaService.deleteMedia(req.params.id, { force });
  if (!result.deleted && result.reason === "NOT_FOUND") {
    return sendError(res, 404, "Media not found.", "NOT_FOUND");
  }
  if (!result.deleted && result.reason === "IN_USE") {
    return sendError(
      res,
      409,
      `Media is used by ${result.usageCount} page(s). Use ?force=true to delete anyway.`,
      "MEDIA_IN_USE",
      { usageCount: result.usageCount },
    );
  }
  return res.status(204).send();
});
