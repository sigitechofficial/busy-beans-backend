const catchAsync = require("../../utils/catchAsync");
const reports = require("../services/reports.service");
const { resolveAccess, logPiiAccess } = require("../services/piiAccess.service");
const { sendData, sendError } = require("../utils/httpResponses");
const {
  rangeFromQuery,
  compareRangeFromQuery,
  modelFromQuery,
  filtersFromQuery,
  cleanFilter,
  landingPageFromQuery,
  toCsv,
  sendCsv,
} = require("../utils/reportQuery");

/** Period echoed back so the UI shows exactly what the server used. */
function periodMeta(range, compareRange) {
  return {
    timeZone: range.tz,
    preset: range.preset,
    from: range.fromDay || null,
    to: range.toDay || null,
    compare: compareRange ? { from: compareRange.fromDay, to: compareRange.toDay } : null,
  };
}

const pctCell = (v) => (v === null || v === undefined ? "" : v);

/** GET /admin/analytics/reports/overview?range|from&to&compare&attribution&channel&… */
exports.overview = catchAsync(async (req, res) => {
  const range = rangeFromQuery(req.query);
  const compareRange = compareRangeFromQuery(req.query, range);
  const data = await reports.getOverview({
    range,
    compareRange,
    model: modelFromQuery(req.query),
    filters: filtersFromQuery(req.query),
  });
  return sendData(res, 200, { ...data, period: periodMeta(range, compareRange) });
});

/** Drill filters + the entry landing page (Phase B / C reports). */
function reportFilters(query) {
  const filters = filtersFromQuery(query);
  const lp = landingPageFromQuery(query);
  if (lp) filters.landingPage = lp;
  return filters;
}

/** CSV key columns of a grouping: one per field for combined groupings (campaignDetail). */
function groupingColumns(dimension) {
  const fields = reports.COMBINED[dimension];
  return fields ? fields.map((f) => ({ header: f, key: f })) : [{ header: dimension, key: "value" }];
}

/**
 * GET /admin/analytics/reports/acquisition?dimension=channel|source|medium|campaign|content|term|
 * landingPage|searchEngine|socialNetwork|campaignDetail&compare=previous&… (&format=csv)
 * Also serves the Organic Search / Social / Referral views (channel filter + grouped dimension).
 * campaignDetail = one row per channel + source + medium + campaign.
 */
exports.acquisition = catchAsync(async (req, res) => {
  const dimension = String(req.query.dimension || "channel");
  if (!reports.GROUPINGS.includes(dimension)) return sendError(res, 400, "Unknown dimension.", "VALIDATION_ERROR");
  const range = rangeFromQuery(req.query);
  const compareRange = compareRangeFromQuery(req.query, range);
  const filters = reportFilters(req.query);
  const data = await reports.getAcquisition({ range, compareRange, model: modelFromQuery(req.query), dimension, filters });
  if (req.query.format === "csv") {
    const columns = [
      ...groupingColumns(dimension),
      { header: "visitors", key: "visitors" },
      { header: "sessions", key: "sessions" },
      { header: "visitor_to_lead_rate_pct", value: (r) => pctCell(r.visitorToLeadRate) },
      { header: "session_to_lead_rate_pct", value: (r) => pctCell(r.sessionToLeadRate) },
      { header: `leads (${data.model})`, key: "leads" },
      { header: "attributed_lead_share_pct", value: (r) => pctCell(r.attributedLeadShare) },
      { header: "qualified_or_won", key: "reachedQualified" },
      { header: "qualified_rate_pct", value: (r) => pctCell(r.qualifiedRate) },
      { header: "won_leads", key: "wonLeads" },
      { header: "win_rate_pct", value: (r) => pctCell(r.winRate) },
      { header: "lead_revenue", key: "leadRevenue" },
      { header: "orders", key: "orders" },
      { header: "order_revenue", key: "orderRevenue" },
    ];
    const name = `${dimension}-${range.fromDay || "all"}-${range.toDay || "time"}.csv`;
    return sendCsv(res, name, toCsv(columns, [...data.rows, data.totals]));
  }
  return sendData(res, 200, { ...data, period: periodMeta(range, compareRange) });
});

exports.periodMeta = periodMeta;
exports.reportFilters = reportFilters;
exports.groupingColumns = groupingColumns;

function leadQuery(query) {
  const out = {};
  for (const key of ["status", "channel", "source", "medium", "campaign", "landingPage", "form", "firstSource", "lastSource", "lndSource", "test", "sort", "dir", "q"]) {
    const v = cleanFilter(query[key]);
    if (v !== undefined) out[key] = v;
  }
  out.page = query.page;
  out.pageSize = query.pageSize;
  return out;
}

/** GET /admin/analytics/reports/leads?range|from&to&page&pageSize&sort&dir&status&channel&… */
exports.leads = catchAsync(async (req, res) => {
  const range = rangeFromQuery(req.query);
  const data = await reports.listLeads({ range, query: leadQuery(req.query) });
  return sendData(res, 200, { ...data, period: periodMeta(range, null) });
});

/** GET /admin/analytics/reports/leads/export — CSV with the same filters (max 10,000 rows). */
exports.exportLeads = catchAsync(async (req, res) => {
  const range = rangeFromQuery(req.query);
  const access = await resolveAccess(req);
  const { rows, columns, truncated, withContact } = await reports.exportLeads({ range, query: leadQuery(req.query), access });
  if (withContact && rows.length) {
    await logPiiAccess(access, { action: "lead_export", subject: "leads", customerIds: rows.map((r) => r.id) }).catch(() => false);
  }
  if (truncated) res.setHeader("X-Export-Truncated", String(reports.EXPORT_LIMIT));
  const name = `leads-${range.fromDay || "all"}-${range.toDay || "time"}.csv`;
  return sendCsv(res, name, toCsv(columns, rows));
});
