const catchAsync = require("../../utils/catchAsync");
const productAnalytics = require("../services/productAnalytics.service");
const { resolveAccess, listPiiAccess, retentionDays } = require("../services/piiAccess.service");
const { rangeFromQuery } = require("../utils/reportQuery");
const { sendData, sendError } = require("../utils/httpResponses");

const PRODUCT_ID = /^[\w-]{1,64}$/;

function range(req) {
  return rangeFromQuery(req.query || {}, { defaultPreset: null });
}

/** GET /admin/analytics/products?from=&to= */
exports.products = catchAsync(async (req, res) => {
  const data = await productAnalytics.getProductReport(range(req));
  return sendData(res, 200, data);
});

/** GET /admin/analytics/products/:productId?from=&to= */
exports.productDetail = catchAsync(async (req, res) => {
  const productId = String(req.params.productId || "");
  if (!PRODUCT_ID.test(productId)) return sendError(res, 400, "Invalid product id.", "VALIDATION_ERROR");
  const access = await resolveAccess(req);
  const data = await productAnalytics.getProductDetail(range(req), productId, access);
  return sendData(res, 200, data);
});

/** GET /admin/analytics/store?from=&to= — store funnel + abandoned carts */
exports.store = catchAsync(async (req, res) => {
  const access = await resolveAccess(req);
  const data = await productAnalytics.getStoreFunnel(range(req), access);
  return sendData(res, 200, data);
});

/** GET /admin/analytics/time-patterns?from=&to= */
exports.timePatterns = catchAsync(async (req, res) => {
  const data = await productAnalytics.getTimePatterns(range(req));
  return sendData(res, 200, data);
});

/** GET /admin/analytics/broken-links?from=&to= */
exports.brokenLinks = catchAsync(async (req, res) => {
  const rows = await productAnalytics.getBrokenLinks(range(req));
  return sendData(res, 200, { rows });
});

/** GET /admin/analytics/journey?visitorId= | leadId= | orderId= | customerUserId= */
exports.journey = catchAsync(async (req, res) => {
  const access = await resolveAccess(req);
  const q = req.query || {};
  try {
    const data = await productAnalytics.getVisitorJourney(
      { visitorId: q.visitorId, leadId: q.leadId, orderId: q.orderId, customerUserId: q.customerUserId },
      access,
    );
    return sendData(res, 200, data);
  } catch (error) {
    if (error.code === "VALIDATION_ERROR" || error.code === "PII_FORBIDDEN") {
      return sendError(res, error.status || 400, error.message, error.code);
    }
    throw error;
  }
});

/** GET /admin/analytics/pii-access-log?userId=&customerId=&limit= — Super Admins only. */
exports.piiAccessLog = catchAsync(async (req, res) => {
  const access = await resolveAccess(req);
  if (String(access.role || "").trim().toLowerCase() !== "super admin") {
    return sendError(res, 403, "Only Super Admins can view the customer data access log.", "FORBIDDEN");
  }
  const q = req.query || {};
  const rows = await listPiiAccess({ userId: q.userId, customerId: q.customerId, limit: q.limit });
  return sendData(res, 200, { rows, retentionDays: retentionDays() });
});
