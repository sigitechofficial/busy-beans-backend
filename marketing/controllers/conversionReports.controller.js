const catchAsync = require("../../utils/catchAsync");
const conversion = require("../services/conversionReports.service");
const { sendData } = require("../utils/httpResponses");
const {
  rangeFromQuery,
  compareRangeFromQuery,
  modelFromQuery,
  filtersFromQuery,
  cleanFilter,
  segmentFromQuery,
  landingPageFromQuery,
  toCsv,
  sendCsv,
} = require("../utils/reportQuery");

/** Reporting Phase B endpoints (conversion behaviour). Same period / filter / CSV rules as Phase A. */

function periodMeta(range, compareRange) {
  return {
    timeZone: range.tz,
    preset: range.preset,
    from: range.fromDay || null,
    to: range.toDay || null,
    compare: compareRange ? { from: compareRange.fromDay, to: compareRange.toDay } : null,
  };
}

/** Drill filters (session acquisition for event reports, lead model for timing) + landing page. */
function conversionFilters(query) {
  const filters = filtersFromQuery(query);
  const lp = landingPageFromQuery(query);
  if (lp) filters.landingPage = lp;
  return filters;
}
const rate = (v) => (v === null || v === undefined ? "" : v);
const csvName = (kind, range) => `${kind}-${range.fromDay || "all"}-${range.toDay || "time"}.csv`;
const hours = (s) => (s === null || s === undefined ? "" : Math.round(s / 36) / 100);

/** GET /reports/forms?…&segment=&form=&page=&format=csv */
exports.forms = catchAsync(async (req, res) => {
  const range = rangeFromQuery(req.query);
  const data = await conversion.getForms({
    range,
    filters: conversionFilters(req.query),
    segment: segmentFromQuery(req.query),
    form: cleanFilter(req.query.form, 120),
    page: cleanFilter(req.query.page, 200),
  });
  if (req.query.format === "csv") {
    const columns = [
      ...(data.segment ? [{ header: data.segment, key: "segment" }] : []),
      { header: "form_id", value: (r) => r.formId || r.formKey },
      { header: "form_label", key: "label" },
      { header: "section_id", key: "sectionId" },
      { header: "page", key: "page" },
      { header: "views", key: "views" },
      { header: "unique_view_sessions", key: "viewSessions" },
      { header: "starts", key: "starts" },
      { header: "unique_start_sessions", key: "startSessions" },
      { header: "submits", key: "submits" },
      { header: "unique_submit_sessions", key: "submitSessions" },
      { header: "leads", key: "leads" },
      { header: "view_to_start_rate_pct", value: (r) => rate(r.viewToStartRate) },
      { header: "start_to_submit_rate_pct", value: (r) => rate(r.startToSubmitRate) },
      { header: "start_to_lead_rate_pct", value: (r) => rate(r.startToLeadRate) },
      { header: "submit_to_lead_rate_pct", value: (r) => rate(r.submitToLeadRate) },
    ];
    return sendCsv(res, csvName("forms", range), toCsv(columns, data.rows));
  }
  return sendData(res, 200, { ...data, period: periodMeta(range, null) });
});

/** GET /reports/ctas?…&format=csv */
exports.ctas = catchAsync(async (req, res) => {
  const range = rangeFromQuery(req.query);
  const data = await conversion.getCtas({ range, filters: conversionFilters(req.query) });
  if (req.query.format === "csv") {
    const columns = [
      { header: "cta_type", key: "kind" },
      { header: "cta_name", key: "name" },
      { header: "cta_location", key: "location" },
      { header: "page", key: "page" },
      { header: "clicks", key: "clicks" },
      { header: "unique_click_sessions", key: "sessions" },
      { header: "lead_sessions_same_session", key: "leadSessions" },
      { header: "cta_to_lead_rate_pct", value: (r) => rate(r.ctaToLeadRate) },
      { header: "sessions_with_lead_in_later_visit", key: "laterLeadSessions" },
    ];
    return sendCsv(res, csvName("ctas", range), toCsv(columns, data.rows));
  }
  return sendData(res, 200, { ...data, period: periodMeta(range, null) });
});

/** GET /reports/funnel?…&scope=landing|any&segment=&format=csv */
exports.funnel = catchAsync(async (req, res) => {
  const range = rangeFromQuery(req.query);
  const data = await conversion.getFunnel({
    range,
    filters: conversionFilters(req.query),
    segment: segmentFromQuery(req.query),
    scope: req.query.scope === "any" ? "any" : "landing",
  });
  if (req.query.format === "csv") {
    const groups = data.segment ? data.segments : [data.overall];
    const rows = groups.flatMap((g) => g.steps.map((s) => ({ segment: g.segment, ...s })));
    const columns = [
      ...(data.segment ? [{ header: data.segment, key: "segment" }] : []),
      { header: "step", key: "step" },
      { header: "sessions", key: "sessions" },
      { header: "previous_step_rate_pct", value: (r) => rate(r.fromPrevious) },
      { header: "cumulative_rate_pct", value: (r) => rate(r.cumulative) },
      { header: "drop_off", value: (r) => rate(r.dropOff) },
    ];
    return sendCsv(res, csvName("funnel", range), toCsv(columns, rows));
  }
  return sendData(res, 200, { ...data, period: periodMeta(range, null) });
});

/** GET /reports/timing?…&segment=&format=csv (lead-level: the attribution model applies) */
exports.timing = catchAsync(async (req, res) => {
  const range = rangeFromQuery(req.query);
  const data = await conversion.getTiming({
    range,
    filters: conversionFilters(req.query),
    model: modelFromQuery(req.query),
    segment: segmentFromQuery(req.query),
  });
  if (req.query.format === "csv") {
    if (data.segment) {
      const columns = [
        { header: data.segment, key: "segment" },
        { header: "leads", key: "leads" },
        { header: "complete_history_leads", value: (r) => r.history.complete },
        { header: "average_hours_to_conversion", value: (r) => hours(r.time.averageSeconds) },
        { header: "median_hours_to_conversion", value: (r) => hours(r.time.medianSeconds) },
        { header: "average_sessions", value: (r) => rate(r.sessions.average) },
        { header: "median_sessions", value: (r) => rate(r.sessions.median) },
        { header: "same_session_pct", value: (r) => rate(r.sessions.sameSessionRate) },
      ];
      return sendCsv(res, csvName("conversion-time", range), toCsv(columns, data.segments));
    }
    const o = data.overall;
    const rows = [
      ...o.time.buckets.map((b) => ({ group: "time_to_conversion", bucket: b.label, leads: b.leads, share: b.share })),
      ...o.sessions.buckets.map((b) => ({ group: "sessions_before_conversion", bucket: b.label, leads: b.leads, share: b.share })),
      { group: "history", bucket: "partial legacy history (excluded)", leads: o.history.partial, share: null },
      { group: "history", bucket: "unknown / insufficient history (excluded)", leads: o.history.unknown, share: null },
    ];
    const columns = [
      { header: "report", key: "group" },
      { header: "bucket", key: "bucket" },
      { header: "leads", key: "leads" },
      { header: "percentage_of_complete_history", value: (r) => rate(r.share) },
    ];
    return sendCsv(res, csvName("conversion-time", range), toCsv(columns, rows));
  }
  return sendData(res, 200, { ...data, period: periodMeta(range, null) });
});

/** GET /reports/trends?…&granularity=day|week|month&compare=previous */
exports.trends = catchAsync(async (req, res) => {
  const range = rangeFromQuery(req.query);
  const compareRange = compareRangeFromQuery(req.query, range);
  const granularity = ["day", "week", "month"].includes(req.query.granularity) ? req.query.granularity : null;
  const data = await conversion.getTrends({
    range,
    compareRange,
    filters: conversionFilters(req.query),
    model: modelFromQuery(req.query),
    granularity,
  });
  return sendData(res, 200, { ...data, period: periodMeta(range, compareRange) });
});
