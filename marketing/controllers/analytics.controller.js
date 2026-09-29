const catchAsync = require("../../utils/catchAsync");
const analyticsDashboardService = require("../services/analyticsDashboard.service");
const pageStatsService = require("../services/pageStats.service");
const { parseReportRange } = require("../utils/businessTime");
const { sendData, sendError } = require("../utils/httpResponses");

const PAGE_TYPES = new Set(["landing_page", "site"]);
const SLUG_RE = /^[A-Za-z0-9._~%-]{1,200}$/;

function reportOptions(query = {}) {
  return {
    range: parseReportRange(query.from, query.to),
    pageType: PAGE_TYPES.has(query.type) ? query.type : "landing_page",
    touch: query.touch === "first" ? "first" : "last",
  };
}

exports.dashboard = catchAsync(async (req, res) => {
  const data = await analyticsDashboardService.getDashboard(req.query || {});
  return sendData(res, 200, data);
});

/** GET /admin/analytics/pages?type=landing_page|site&from=YYYY-MM-DD&to=YYYY-MM-DD&touch=last|first */
exports.pages = catchAsync(async (req, res) => {
  const options = reportOptions(req.query);
  const data = await pageStatsService.getPageStats(options);
  return sendData(res, 200, { ...data, pageType: options.pageType, touch: options.touch });
});

/** GET /admin/analytics/pages/:slug?type=…&from=…&to=…&touch=… */
exports.pageDetail = catchAsync(async (req, res) => {
  const slug = String(req.params.slug || "");
  if (!SLUG_RE.test(slug)) return sendError(res, 400, "Invalid page slug.", "VALIDATION_ERROR");
  const options = reportOptions(req.query);
  const data = await pageStatsService.getPageDetail({ ...options, pageSlug: slug });
  return sendData(res, 200, data);
});
