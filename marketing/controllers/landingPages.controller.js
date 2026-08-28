const catchAsync = require("../../utils/catchAsync");
const landingPagesService = require("../services/landingPages.service");
const { sendData, sendError } = require("../utils/httpResponses");

function sendKnownError(res, error) {
  if (error.code === "SLUG_TAKEN") {
    return sendError(res, 409, error.message, error.code);
  }
  if (error.code === "INVALID_SLUG") {
    return sendError(res, 400, error.message, error.code);
  }
  if (error.code === "VALIDATION_FAILED") {
    return sendError(res, 400, error.message, error.code, error.details);
  }
  return sendError(res, 500, "Unable to process request.", "INTERNAL_ERROR");
}

exports.list = catchAsync(async (_req, res) => {
  const data = await landingPagesService.listLandingPages();
  return sendData(res, 200, data);
});

exports.getById = catchAsync(async (req, res) => {
  const page = await landingPagesService.getLandingPageById(req.params.id);
  if (!page) {
    return sendError(res, 404, "Landing page not found.", "NOT_FOUND");
  }
  return sendData(res, 200, page);
});

exports.create = catchAsync(async (req, res) => {
  try {
    const page = await landingPagesService.createLandingPage(req.body || {}, req.marketingUser);
    return sendData(res, 201, page);
  } catch (error) {
    return sendKnownError(res, error);
  }
});

exports.patchDraft = catchAsync(async (req, res) => {
  const page = await landingPagesService.patchDraft(req.params.id, req.body || {}, req.marketingUser);
  if (!page) {
    return sendError(res, 404, "Landing page not found.", "NOT_FOUND");
  }
  return sendData(res, 200, page);
});

exports.validate = catchAsync(async (req, res) => {
  const page = await landingPagesService.getLandingPageById(req.params.id);
  if (!page) {
    return sendError(res, 404, "Landing page not found.", "NOT_FOUND");
  }
  const data = landingPagesService.runPublishValidation(page);
  return sendData(res, 200, data);
});

exports.publish = catchAsync(async (req, res) => {
  try {
    const page = await landingPagesService.publishLandingPage(
      req.params.id,
      req.body || {},
      req.marketingUser,
    );
    if (!page) {
      return sendError(res, 404, "Landing page not found.", "NOT_FOUND");
    }
    return sendData(res, 200, page);
  } catch (error) {
    return sendKnownError(res, error);
  }
});

exports.unpublish = catchAsync(async (req, res) => {
  const page = await landingPagesService.unpublishLandingPage(req.params.id, req.marketingUser);
  if (!page) {
    return sendError(res, 404, "Landing page not found.", "NOT_FOUND");
  }
  return sendData(res, 200, page);
});

exports.duplicate = catchAsync(async (req, res) => {
  const page = await landingPagesService.duplicateLandingPage(req.params.id, req.marketingUser);
  if (!page) {
    return sendError(res, 404, "Landing page not found.", "NOT_FOUND");
  }
  return sendData(res, 201, page);
});

exports.archive = catchAsync(async (req, res) => {
  const page = await landingPagesService.archiveLandingPage(req.params.id, req.marketingUser);
  if (!page) {
    return sendError(res, 404, "Landing page not found.", "NOT_FOUND");
  }
  return sendData(res, 200, page);
});

exports.remove = catchAsync(async (req, res) => {
  const result = await landingPagesService.deleteLandingPage(req.params.id);
  if (!result.deleted && result.reason === "NOT_FOUND") {
    return sendError(res, 404, "Landing page not found.", "NOT_FOUND");
  }
  if (!result.deleted && result.reason === "IN_USE") {
    const names = (result.campaigns || []).map((c) => c.name).join(", ");
    return sendError(
      res,
      409,
      `This page is used by campaigns: ${names}. Unlink it in Campaigns before deleting.`,
      "PAGE_IN_USE",
      { campaigns: result.campaigns || [] },
    );
  }
  return res.status(204).send();
});

exports.restore = catchAsync(async (req, res) => {
  const versionNumber = Number(req.body?.versionNumber);
  if (!versionNumber) {
    return sendError(res, 400, "versionNumber is required.", "VALIDATION_ERROR");
  }
  const page = await landingPagesService.restoreLandingPageVersion(
    req.params.id,
    versionNumber,
    req.marketingUser,
  );
  if (!page) {
    return sendError(res, 404, "Landing page or version not found.", "NOT_FOUND");
  }
  return sendData(res, 200, page);
});

exports.previewToken = catchAsync(async (req, res) => {
  const data = await landingPagesService.regeneratePreviewToken(req.params.id);
  if (!data) {
    return sendError(res, 404, "Landing page not found.", "NOT_FOUND");
  }
  return sendData(res, 200, data);
});
