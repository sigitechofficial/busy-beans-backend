const catchAsync = require("../../utils/catchAsync");
const landingPagesService = require("../services/landingPages.service");
const { sendData, sendError } = require("../utils/httpResponses");

exports.getBySlug = catchAsync(async (req, res) => {
  const data = await landingPagesService.getPublicLandingPageBySlug(req.params.slug);
  if (!data) {
    return sendError(res, 404, "Landing page not found.", "NOT_FOUND");
  }

  res.set("Cache-Control", "public, max-age=60");
  return sendData(res, 200, data);
});

/** Live, indexable landing pages for the website's sitemap-landing-pages.xml. */
exports.listForSitemap = catchAsync(async (_req, res) => {
  const data = await landingPagesService.listSitemapLandingPages();
  res.set("Cache-Control", "public, max-age=300");
  return sendData(res, 200, data);
});

exports.getPreviewByToken = catchAsync(async (req, res) => {
  const token = String(req.query.token || "");
  const data = await landingPagesService.getPreviewLandingPageByToken(
    req.params.pageId,
    token,
  );

  if (data === "invalid_token") {
    return sendError(res, 401, "Invalid preview token.", "INVALID_PREVIEW_TOKEN");
  }
  if (!data) {
    return sendError(res, 404, "Landing page not found.", "NOT_FOUND");
  }

  return sendData(res, 200, data);
});
