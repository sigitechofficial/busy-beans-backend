const catchAsync = require("../../utils/catchAsync");
const outcomes = require("../services/outcomeReports.service");
const { sendData, sendError } = require("../utils/httpResponses");
const { rangeFromQuery, compareRangeFromQuery, modelFromQuery, cleanFilter, toCsv, sendCsv } = require("../utils/reportQuery");
const { periodMeta, reportFilters, groupingColumns, spendColumns } = require("./reports.controller");

/** Reporting Phase C endpoints (business outcomes). Same period / filter / CSV rules as Phase A / B. */

const rate = (v) => (v === null || v === undefined ? "" : v);
const csvName = (kind, range, extra = "") => `${kind}${extra ? `-${extra}` : ""}-${range.fromDay || "all"}-${range.toDay || "time"}.csv`;
const dimensionOf = (query, allowed) => {
  const d = String(query.dimension || "channel");
  return allowed.includes(d) ? d : null;
};

/** GET /reports/lead-quality?dimension=channel|source|medium|campaign|content|term|landingPage|campaignDetail&attribution&compare&…&format=csv */
exports.leadQuality = catchAsync(async (req, res) => {
  const dimension = dimensionOf(req.query, outcomes.LEAD_QUALITY_DIMENSIONS);
  if (!dimension) return sendError(res, 400, "Unknown dimension.", "VALIDATION_ERROR");
  const range = rangeFromQuery(req.query);
  const compareRange = compareRangeFromQuery(req.query, range);
  const filters = reportFilters(req.query);
  const data = await outcomes.getLeadQuality({ range, compareRange, model: modelFromQuery(req.query), dimension, filters });
  if (req.query.format === "csv") {
    const columns = [
      ...groupingColumns(dimension),
      { header: "attribution_model", value: () => data.model },
      { header: "leads", key: "leads" },
      { header: "new", key: "newLeads" },
      { header: "contacted", key: "contacted" },
      { header: "qualified", key: "qualified" },
      { header: "won", key: "wonLeads" },
      { header: "lost", key: "lost" },
      { header: "qualified_or_won", key: "reachedQualified" },
      { header: "qualified_rate", value: (r) => rate(r.qualifiedRate) },
      { header: "win_rate", value: (r) => rate(r.winRate) },
      { header: "loss_rate", value: (r) => rate(r.lossRate) },
      { header: "lead_revenue", key: "leadRevenue" },
      { header: "average_won_value", value: (r) => rate(r.averageWonValue) },
      { header: "revenue_per_lead", value: (r) => rate(r.revenuePerLead) },
      { header: "revenue_per_qualified_lead", value: (r) => rate(r.revenuePerQualifiedLead) },
    ];
    return sendCsv(res, csvName("lead-quality", range, dimension), toCsv(columns, [...data.rows, data.totals]));
  }
  return sendData(res, 200, { ...data, period: periodMeta(range, compareRange) });
});

/** GET /reports/revenue?dimension=channel|source|medium|campaign|content|term|campaignDetail&attribution&compare&…&format=csv */
exports.revenue = catchAsync(async (req, res) => {
  const dimension = dimensionOf(req.query, outcomes.REVENUE_DIMENSIONS);
  if (!dimension) return sendError(res, 400, "Unknown dimension.", "VALIDATION_ERROR");
  const range = rangeFromQuery(req.query);
  const compareRange = compareRangeFromQuery(req.query, range);
  const filters = reportFilters(req.query);
  const data = await outcomes.getRevenue({ range, compareRange, model: modelFromQuery(req.query), dimension, filters });
  if (req.query.format === "csv") {
    const columns = [
      ...groupingColumns(dimension),
      { header: "lead_attribution_model", value: () => data.model },
      { header: "leads", key: "leads" },
      { header: "won_leads", key: "wonLeads" },
      { header: "lead_revenue", key: "leadRevenue" },
      { header: "average_won_value", value: (r) => rate(r.averageWonValue) },
      { header: "revenue_per_lead", value: (r) => rate(r.revenuePerLead) },
      { header: "order_attribution", value: () => data.orderModel },
      { header: "orders", key: "orders" },
      { header: "order_revenue", key: "orderRevenue" },
      { header: "average_order_value", value: (r) => rate(r.averageOrderValue) },
      ...spendColumns(data),
    ];
    return sendCsv(res, csvName("revenue", range, dimension), toCsv(columns, [...data.rows, data.totals]));
  }
  return sendData(res, 200, { ...data, period: periodMeta(range, compareRange) });
});

/** GET /reports/attribution-comparison?dimension=channel|source|campaign&…&format=csv (all six models) */
exports.attributionComparison = catchAsync(async (req, res) => {
  const dimension = dimensionOf(req.query, outcomes.COMPARISON_DIMENSIONS);
  if (!dimension) return sendError(res, 400, "Unknown dimension.", "VALIDATION_ERROR");
  const range = rangeFromQuery(req.query);
  const data = await outcomes.getAttributionComparison({ range, dimension });
  if (req.query.format === "csv") {
    const CSV_MODEL = { operational: "operational", first: "first_touch", last: "last_touch", last_non_direct: "last_non_direct", session: "session", conversion: "conversion" };
    const block = (metric, suffix) => outcomes.COMPARISON_MODELS.map((m) => ({ header: `${CSV_MODEL[m]}_${suffix}`, value: (r) => r.models[m][metric] }));
    const columns = [
      { header: "dimension", key: "value" },
      ...block("leads", "leads"),
      ...block("wonLeads", "won"),
      ...block("leadRevenue", "lead_revenue"),
    ];
    const total = { value: "Total", models: data.totals };
    return sendCsv(res, csvName("attribution-comparison", range, dimension), toCsv(columns, [...data.rows, total]));
  }
  return sendData(res, 200, { ...data, period: periodMeta(range, null) });
});

/** GET /reports/audience/devices?dimension=deviceType|os|browser&range|from&to&compare&attribution&…&format=csv */
exports.devices = catchAsync(async (req, res) => {
  const dimension = String(req.query.dimension || "deviceType");
  if (!outcomes.DEVICE_DIMENSIONS.includes(dimension)) return sendError(res, 400, "Unknown dimension.", "VALIDATION_ERROR");
  const range = rangeFromQuery(req.query);
  const compareRange = compareRangeFromQuery(req.query, range);
  const filters = reportFilters(req.query);
  const data = await outcomes.getDevices({ range, compareRange, model: modelFromQuery(req.query), dimension, filters });
  if (req.query.format === "csv") {
    const columns = [
      { header: dimension, key: "value" },
      { header: "visitors", key: "visitors" },
      { header: "sessions", key: "sessions" },
      { header: "share_of_sessions_pct", value: (r) => rate(r.sessionShare) },
      { header: "visitor_to_lead_rate_pct", value: (r) => rate(r.visitorToLeadRate) },
      { header: "session_to_lead_rate_pct", value: (r) => rate(r.sessionToLeadRate) },
      { header: "leads", key: "leads" },
      { header: "qualified_or_won", key: "reachedQualified" },
      { header: "won_leads", key: "wonLeads" },
      { header: "lead_revenue", key: "leadRevenue" },
    ];
    return sendCsv(res, csvName("devices", range, dimension), toCsv(columns, [...data.rows, data.totals]));
  }
  return sendData(res, 200, { ...data, period: periodMeta(range, compareRange) });
});

/** GET /reports/audience/new-returning?range|from&to&compare&format=csv */
exports.newReturning = catchAsync(async (req, res) => {
  const range = rangeFromQuery(req.query);
  const compareRange = compareRangeFromQuery(req.query, range);
  const data = await outcomes.getNewReturning({ range, compareRange });
  if (req.query.format === "csv") {
    const columns = [
      { header: "visitor_type", key: "value" },
      { header: "visitors", key: "visitors" },
      { header: "sessions", key: "sessions" },
      { header: "average_visits_per_visitor", value: (r) => rate(r.averageVisitsPerVisitor) },
      { header: "leads", key: "leads" },
      { header: "visitor_to_lead_rate_pct", value: (r) => rate(r.visitorToLeadRate) },
      { header: "session_to_lead_rate_pct", value: (r) => rate(r.sessionToLeadRate) },
      { header: "qualified_or_won", key: "reachedQualified" },
      { header: "won_leads", key: "wonLeads" },
      { header: "lead_revenue", key: "leadRevenue" },
      { header: "orders", key: "orders" },
      { header: "order_revenue", key: "orderRevenue" },
    ];
    return sendCsv(res, csvName("new-vs-returning", range), toCsv(columns, data.rows));
  }
  return sendData(res, 200, { ...data, period: periodMeta(range, compareRange) });
});

/** GET /reports/audience/direct?range|from&to&compare&format=csv */
exports.direct = catchAsync(async (req, res) => {
  const range = rangeFromQuery(req.query);
  const compareRange = compareRangeFromQuery(req.query, range);
  const data = await outcomes.getDirect({ range, compareRange });
  if (req.query.format === "csv") {
    const columns = [
      { header: "operational_channel", key: "channel" },
      { header: "operational_source", key: "source" },
      { header: "operational_campaign", key: "campaign" },
      { header: "leads_converted_in_direct_visit", key: "leads" },
      { header: "won_leads", key: "wonLeads" },
      { header: "lead_revenue", key: "leadRevenue" },
    ];
    return sendCsv(res, csvName("direct-credited-to", range), toCsv(columns, data.creditedTo));
  }
  return sendData(res, 200, { ...data, period: periodMeta(range, compareRange) });
});

/** GET /reports/audience/referrer-urls?source=<referral source>&range… (on demand, top 50) */
exports.referrerUrls = catchAsync(async (req, res) => {
  const source = cleanFilter(req.query.source, 100);
  if (!source) return sendError(res, 400, "source is required.", "VALIDATION_ERROR");
  const range = rangeFromQuery(req.query);
  const data = await outcomes.getReferrerUrls({ range, source });
  return sendData(res, 200, { ...data, period: periodMeta(range, null) });
});
