/**
 * Reporting Phase A: overview KPIs, acquisition drill-down (channel → source → medium → campaign
 * → content / term) and the lead list / export. Definitions: docs/analytics/EVENT_CONTRACT.md
 * ("Reporting definitions"); shared rules in utils/reportQuery, utils/reportFilters,
 * utils/leadAttributionSql.
 *
 * Two kinds of numbers, never mixed in one ratio:
 *   acquisition  real sessions that STARTED in the period, grouped by the session's own
 *                acquisition touch (marketing_sessions.channel/source/…): visitors, sessions and
 *                the acquisition rates (visitor → lead, session → lead; always ≤ 100%)
 *   attribution  real leads SUBMITTED in the period, grouped by the selected attribution model:
 *                leads, attributed lead share, won leads and lead revenue (won leads of that
 *                cohort). Order revenue uses the order's own attribution (first / last
 *                non-direct touch at checkout) and is reported separately, never added.
 */
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getLeadSubmissionModel } = require("../models/leadSubmission");
const { formatLeadRow } = require("./leadSubmissions.service");
const { leadAttrExpr, UNKNOWN_DEFAULTS } = require("../utils/leadAttributionSql");
const { realSessions, realEvents } = require("../utils/reportFilters");
const { MODELS, DIMENSIONS, rangeSql } = require("../utils/reportQuery");

const select = (sql, replacements) => getMarketingSequelize().query(sql, { replacements, type: QueryTypes.SELECT });
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (v) => Math.round(num(v) * 100) / 100;
/** Percentage with one decimal; null when the denominator is 0 (UI shows "—"). */
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

// ── dimension expressions (same buckets for sessions, leads and orders) ───────

/**
 * Report dimensions: the drill dimensions plus three derived ones —
 *   landingPage    the visit's entry landing page / the lead's landing page / the order's landing page
 *   searchEngine   source grouped into Google · Bing · DuckDuckGo · Yahoo · Other (Organic Search view)
 *   socialNetwork  source grouped into Facebook · Instagram · LinkedIn · … · Other (social views)
 * The source groups use the canonical source names written by utils/attribution.js.
 */
const NO_LP = "(not a landing page)";
const REPORT_DIMENSIONS = [...DIMENSIONS, "landingPage", "searchEngine", "socialNetwork"];
/**
 * Combined groupings (grouping only, never a filter): one row per combination of the fields, so a
 * campaign run on two platforms is two rows. The row's `value` is the last field and each field is
 * also returned on the row (e.g. { value: campaign, channel, source, medium, campaign }).
 */
const COMBINED = { campaignDetail: ["channel", "source", "medium", "campaign"] };
const GROUPINGS = [...REPORT_DIMENSIONS, ...Object.keys(COMBINED)];
const SEP = "\u001f";
/** GROUP BY expression of a grouping for one dataset (`exprFor` = that dataset's field expression). */
function groupSql(exprFor, field) {
  const fields = COMBINED[field];
  return fields ? `CONCAT_WS(CHAR(31 USING utf8mb4), ${fields.map(exprFor).join(", ")})` : exprFor(field);
}
const DIMENSION_DEFAULTS = { ...UNKNOWN_DEFAULTS, landingPage: NO_LP, searchEngine: "Other", socialNetwork: "Other" };
const SEARCH_ENGINES = [["Google", ["google"]], ["Bing", ["bing"]], ["DuckDuckGo", ["duckduckgo"]], ["Yahoo", ["yahoo"]]];
const SOCIAL_NETWORKS = [
  ["Facebook", ["facebook", "fb", "m.facebook.com", "messenger"]],
  ["Instagram", ["instagram", "ig"]],
  ["LinkedIn", ["linkedin", "lnkd.in"]],
  ["TikTok", ["tiktok"]],
  ["YouTube", ["youtube", "youtu.be"]],
  ["X", ["x", "twitter", "t.co"]],
  ["Reddit", ["reddit"]],
  ["Pinterest", ["pinterest", "pin.it"]],
];
function sourceGroup(sourceSql, groups) {
  const whens = groups.map(([label, names]) => `WHEN LOWER(${sourceSql}) IN (${names.map((n) => `'${n}'`).join(", ")}) THEN '${label}'`);
  return `CASE ${whens.join(" ")} ELSE 'Other' END`;
}
/** Derived dimension from the dataset's source / landing-page expressions (null → plain field). */
function derived(field, sourceSql, landingSql) {
  if (field === "landingPage") return `COALESCE(NULLIF(${landingSql}, ''), '${NO_LP}')`;
  if (field === "searchEngine") return sourceGroup(sourceSql, SEARCH_ENGINES);
  if (field === "socialNetwork") return sourceGroup(sourceSql, SOCIAL_NETWORKS);
  return null;
}

const sessionField = (field) => `COALESCE(NULLIF(s.${field}, ''), '${UNKNOWN_DEFAULTS[field]}')`;
const sessionExpr = (field) => derived(field, sessionField("source"), "s.entry_landing_page_slug") || sessionField(field);
const leadExpr = (field, model) =>
  derived(field, leadAttrExpr("source", { touch: MODELS[model].touch, unknown: true }), "l.landing_page_slug") ||
  leadAttrExpr(field, { touch: MODELS[model].touch, unknown: true });

const CATEGORY_CHANNEL = `CASE LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(%T, '$.category')), ''))
  WHEN 'paid_search' THEN 'Paid Search' WHEN 'paid_social' THEN 'Paid Social'
  WHEN 'organic_search' THEN 'Organic Search' WHEN 'social' THEN 'Organic Social'
  WHEN 'email' THEN 'Email' WHEN 'referral' THEN 'Referral' WHEN 'ai_assistant' THEN 'Referral'
  WHEN 'qr' THEN 'QR' WHEN 'direct' THEN 'Direct' ELSE NULL END`;
function orderField(field, model) {
  const column = MODELS[model].orderTouch === "first" ? "m.first_touch" : "m.last_touch";
  const value = `NULLIF(JSON_UNQUOTE(JSON_EXTRACT(${column}, '$.${field}')), '')`;
  if (field === "channel") return `COALESCE(${value}, ${CATEGORY_CHANNEL.replace("%T", column)}, 'Unknown')`;
  return `COALESCE(${value}, '${UNKNOWN_DEFAULTS[field]}')`;
}
const orderExpr = (field, model) => derived(field, orderField("source", model), "m.landing_page_slug") || orderField(field, model);

/** WHERE fragments for drill filters, one per dataset. */
function filterSql(filters, exprFor, prefix) {
  const parts = [];
  const replacements = {};
  for (const [field, value] of Object.entries(filters || {})) {
    if (!REPORT_DIMENSIONS.includes(field) || value === undefined) continue;
    const key = `${prefix}_${field}`;
    parts.push(`${exprFor(field)} = :${key}`);
    replacements[key] = value;
  }
  return { sql: parts.length ? ` AND ${parts.join(" AND ")}` : "", replacements };
}

/** Real leads submitted in the range (optionally one session / visitor set joined). */
function leadRangeSql(range, prefix = "l") {
  const r = rangeSql(range, "l.submitted_at", `${prefix}_`);
  return { sql: `l.test_mode = 0 AND ${r.sql}`, replacements: r.replacements };
}

// ── acquisition side (sessions) ───────────────────────────────────────────────

/**
 * Sessions started in the range, grouped by `field` (or ungrouped when field is null):
 * sessions, visitors, sessions that produced a lead, visitors who submitted a lead.
 */
/**
 * Session filters: a plain column comparison when the value is not the Unknown / (not set) bucket
 * (NULLIF(col, '') = 'x' ⇔ col = 'x'), so (channel, started_at) / (source, medium) indexes apply;
 * the bucket itself and derived dimensions keep the full expression.
 */
const PLAIN_SESSION_FIELDS = new Set(["channel", "source", "medium", "campaign", "content", "term"]);
const sessionFilterExpr = (filters) => (field) =>
  PLAIN_SESSION_FIELDS.has(field) && filters[field] !== UNKNOWN_DEFAULTS[field] ? `s.${field}` : sessionExpr(field);

async function sessionMetrics(range, filters, field) {
  const r = rangeSql(range, "s.started_at", "s_");
  const f = filterSql(filters, sessionFilterExpr(filters || {}), "sf");
  const lr = leadRangeSql(range, "ls");
  const lv = leadRangeSql(range, "lv");
  const group = field ? groupSql(sessionExpr, field) : null;
  const rows = await select(
    `SELECT ${group ? `${group} AS grp,` : ""}
            COUNT(*) AS sessions,
            COUNT(DISTINCT s.visitor_id) AS visitors,
            SUM(ls.session_id IS NOT NULL) AS leadSessions,
            COUNT(DISTINCT CASE WHEN lv.visitor_id IS NOT NULL THEN s.visitor_id END) AS leadVisitors
     FROM marketing_sessions s
     LEFT JOIN (SELECT DISTINCT l.session_id FROM lead_submissions l
                WHERE ${lr.sql} AND l.session_id IS NOT NULL) ls ON ls.session_id = s.session_id
     LEFT JOIN (SELECT DISTINCT l.visitor_id FROM lead_submissions l
                WHERE ${lv.sql} AND l.visitor_id IS NOT NULL) lv ON lv.visitor_id = s.visitor_id
     WHERE ${realSessions("s")} AND ${r.sql}${f.sql}
     ${group ? `GROUP BY ${group}` : ""}`,
    { ...r.replacements, ...f.replacements, ...lr.replacements, ...lv.replacements },
  );
  return rows;
}

// ── attribution side (leads, orders) ──────────────────────────────────────────

/**
 * Current-status counts of a lead set (statuses are mutually exclusive, so they add up to leads)
 * and lead revenue = revenue entered on the WON leads (entered amounts on other statuses are not
 * revenue yet). `wonWithRevenue` = won leads with an amount entered (average won value).
 */
const LEAD_STATUS_SQL = `SUM(l.conversion_status = 'new') AS newLeads,
            SUM(l.conversion_status = 'contacted') AS contacted,
            SUM(l.conversion_status = 'qualified') AS qualified,
            SUM(l.conversion_status = 'won') AS wonLeads,
            SUM(l.conversion_status = 'lost') AS lost,
            SUM(l.conversion_status = 'won' AND l.revenue IS NOT NULL) AS wonWithRevenue,
            SUM(CASE WHEN l.conversion_status = 'won' THEN COALESCE(l.revenue, 0) ELSE 0 END) AS leadRevenue`;
const LEAD_COUNT_KEYS = ["leads", "newLeads", "contacted", "qualified", "wonLeads", "lost", "wonWithRevenue"];

async function leadMetrics(range, filters, model, field) {
  const lr = leadRangeSql(range);
  const f = filterSql(filters, (d) => leadExpr(d, model), "lf");
  const group = field ? groupSql((d) => leadExpr(d, model), field) : null;
  return select(
    `SELECT ${group ? `${group} AS grp,` : ""}
            COUNT(*) AS leads,
            ${LEAD_STATUS_SQL}
     FROM lead_submissions l
     WHERE ${lr.sql}${f.sql}
     ${group ? `GROUP BY ${group}` : ""}`,
    { ...lr.replacements, ...f.replacements },
  );
}

async function orderMetrics(range, filters, model, field) {
  const r = rangeSql(range, "m.paid_at", "o_");
  const f = filterSql(filters, (d) => orderExpr(d, model), "of");
  const group = field ? groupSql((d) => orderExpr(d, model), field) : null;
  return select(
    `SELECT ${group ? `${group} AS grp,` : ""} COUNT(*) AS orders, SUM(m.revenue) AS orderRevenue
     FROM marketing_order_attribution m
     WHERE m.status = 'paid' AND ${r.sql}${f.sql}
     ${group ? `GROUP BY ${group}` : ""}`,
    { ...r.replacements, ...f.replacements },
  );
}

const ratio = (a, b) => (b > 0 ? money(a / b) : null);

/**
 * Derived metrics of one row. Status stages are read from the CURRENT status (no status history):
 *   reachedContacted = contacted + qualified + won; reachedQualified = qualified + won — Won is
 *   the later stage, but the system does not record whether a won lead was ever marked Contacted /
 *   Qualified. Lost leads are not counted as qualified (the stage they were lost at is unknown).
 *   qualifiedRate = reachedQualified ÷ leads · winRate = won ÷ leads · lossRate = lost ÷ leads
 *   averageWonValue = lead revenue ÷ won leads WITH an amount entered
 *   revenuePerLead / revenuePerQualifiedLead = lead revenue ÷ leads / ÷ reachedQualified
 *   averageOrderValue = order revenue ÷ paid orders
 */
function finishRow(row, totalLeads) {
  const leadRevenue = money(row.leadRevenue);
  const orderRevenue = money(row.orderRevenue);
  const reachedQualified = num(row.qualified) + num(row.wonLeads);
  return {
    ...row,
    leadRevenue,
    orderRevenue,
    reachedContacted: num(row.contacted) + reachedQualified,
    reachedQualified,
    attributedLeadShare: pct(row.leads, totalLeads),
    visitorToLeadRate: pct(row.leadVisitors, row.visitors),
    sessionToLeadRate: pct(row.leadSessions, row.sessions),
    qualifiedRate: pct(reachedQualified, row.leads),
    winRate: pct(row.wonLeads, row.leads),
    lossRate: pct(row.lost, row.leads),
    averageWonValue: ratio(leadRevenue, num(row.wonWithRevenue)),
    revenuePerLead: ratio(leadRevenue, row.leads),
    revenuePerQualifiedLead: ratio(leadRevenue, reachedQualified),
    averageOrderValue: ratio(orderRevenue, row.orders),
  };
}

/**
 * One level of the acquisition drill-down.
 * @param {{ range, model, dimension, filters }} options  filters = parent levels (e.g. channel)
 */
const EMPTY_ROW = () => ({
  visitors: 0, sessions: 0, leadVisitors: 0, leadSessions: 0,
  leads: 0, newLeads: 0, contacted: 0, qualified: 0, wonLeads: 0, lost: 0, wonWithRevenue: 0, leadRevenue: 0,
  orders: 0, orderRevenue: 0,
});
const ALL_PARTS = { sessions: true, leads: true, orders: true };
const none = () => Promise.resolve([]);

/** Totals of one period (distinct visitors, not a sum of rows). */
async function periodTotals(range, filters, model, parts) {
  const [[s], [l], [o]] = await Promise.all([
    parts.sessions ? sessionMetrics(range, filters, null) : none(),
    parts.leads ? leadMetrics(range, filters, model, null) : none(),
    parts.orders ? orderMetrics(range, filters, model, null) : none(),
  ]);
  const row = { value: "Total", ...EMPTY_ROW() };
  for (const k of ["visitors", "sessions", "leadSessions", "leadVisitors"]) row[k] = num(s?.[k]);
  for (const k of LEAD_COUNT_KEYS) row[k] = num(l?.[k]);
  row.leadRevenue = num(l?.leadRevenue);
  row.orders = num(o?.orders);
  row.orderRevenue = num(o?.orderRevenue);
  return finishRow(row, row.leads);
}

/** Metrics compared with the previous period (totals only; see compareMetrics). */
const COMPARED = [
  "visitors", "sessions", "visitorToLeadRate", "sessionToLeadRate", "leads", "reachedQualified", "qualifiedRate",
  "wonLeads", "winRate", "lost", "lossRate", "leadRevenue", "averageWonValue", "orders", "orderRevenue", "averageOrderValue",
];
const pickCompared = (row) => Object.fromEntries(COMPARED.map((k) => [k, row[k] ?? null]));

/**
 * One grouping of the shared outcome metrics (Phase A acquisition drill-down, Phase C lead
 * quality / revenue / audience views).
 * @param {{ range, compareRange?, model, dimension, filters, parts? }} options
 *   filters = parent levels (e.g. channel); parts = which datasets to read (sessions / leads /
 *   orders — reports that do not show visits skip the session queries).
 */
async function getAcquisition({ range, compareRange = null, model = "operational", dimension = "channel", filters = {}, parts = ALL_PARTS }) {
  if (!GROUPINGS.includes(dimension)) throw Object.assign(new Error("Unknown dimension."), { code: "VALIDATION_ERROR" });
  const [sessions, leads, orders, totals, previous] = await Promise.all([
    parts.sessions ? sessionMetrics(range, filters, dimension) : none(),
    parts.leads ? leadMetrics(range, filters, model, dimension) : none(),
    parts.orders ? orderMetrics(range, filters, model, dimension) : none(),
    periodTotals(range, filters, model, parts),
    compareRange ? periodTotals(compareRange, filters, model, parts) : Promise.resolve(null),
  ]);
  const rows = new Map();
  const combined = COMBINED[dimension];
  const rowFor = (label) => {
    if (combined) {
      const parts = String(label ?? "").split(SEP);
      const fields = Object.fromEntries(combined.map((f, i) => [f, String(parts[i] ?? "").trim() || DIMENSION_DEFAULTS[f]]));
      const key = combined.map((f) => fields[f].toLowerCase()).join(SEP);
      if (!rows.has(key)) rows.set(key, { value: fields[combined[combined.length - 1]], ...fields, ...EMPTY_ROW() });
      return rows.get(key);
    }
    const name = String(label ?? "").trim() || DIMENSION_DEFAULTS[dimension];
    const key = name.toLowerCase();
    if (!rows.has(key)) rows.set(key, { value: name, ...EMPTY_ROW() });
    return rows.get(key);
  };
  for (const r of sessions) {
    const row = rowFor(r.grp);
    for (const k of ["sessions", "visitors", "leadSessions", "leadVisitors"]) row[k] += num(r[k]);
  }
  for (const r of leads) {
    const row = rowFor(r.grp);
    for (const k of LEAD_COUNT_KEYS) row[k] += num(r[k]);
    row.leadRevenue += num(r.leadRevenue);
  }
  for (const r of orders) {
    const row = rowFor(r.grp);
    row.orders += num(r.orders);
    row.orderRevenue += num(r.orderRevenue);
  }
  return {
    dimension,
    model,
    modelLabel: MODELS[model].label,
    filters,
    rows: [...rows.values()]
      .map((r) => finishRow(r, totals.leads))
      .sort((a, b) => b.leads - a.leads || b.sessions - a.sessions || b.orderRevenue - a.orderRevenue || a.value.localeCompare(b.value)),
    totals,
    comparison: previous ? compareMetrics(pickCompared(totals), pickCompared(previous)) : null,
  };
}

// ── overview ──────────────────────────────────────────────────────────────────

/** New / returning among visitors with a real session started in the range (see definitions). */
async function visitorSplit(range, filters) {
  const r = rangeSql(range, "s.started_at", "a_");
  const f = filterSql(filters, sessionExpr, "vf");
  const upToEnd = range?.end ? "AND s2.started_at < :a_end" : "";
  const [row] = await select(
    // Not "AS returning": RETURNING is a reserved word in MariaDB (the staging / production DB).
    `SELECT COUNT(*) AS visitors, COALESCE(SUM(v.n >= 2), 0) AS returningVisitors
     FROM (
       SELECT a.visitor_id, COUNT(DISTINCT s2.session_id) AS n
       FROM (SELECT DISTINCT s.visitor_id FROM marketing_sessions s WHERE ${realSessions("s")} AND ${r.sql}${f.sql}) a
       JOIN marketing_sessions s2 ON s2.visitor_id = a.visitor_id AND ${realSessions("s2")} ${upToEnd}
       GROUP BY a.visitor_id
     ) v`,
    { ...r.replacements, ...f.replacements },
  );
  const visitors = num(row?.visitors);
  const returning = num(row?.returningVisitors);
  return { newVisitors: visitors - returning, returningVisitors: returning };
}

async function pageViews(range) {
  const r = rangeSql(range, "e.timestamp", "pv_");
  const [row] = await select(
    `SELECT COUNT(*) AS n FROM marketing_analytics_events e
     WHERE e.event_type IN ('page_view', 'landing_page_view') AND ${realEvents("e")} AND ${r.sql}`,
    r.replacements,
  );
  return num(row?.n);
}

async function overviewFor(range, model, filters) {
  const filtered = Object.keys(filters || {}).length > 0;
  const [[s], [l], [o], split, views] = await Promise.all([
    sessionMetrics(range, filters, null),
    leadMetrics(range, filters, model, null),
    orderMetrics(range, filters, model, null),
    visitorSplit(range, filters),
    // Page views are not attributed; with a drill filter they are not shown.
    filtered ? Promise.resolve(null) : pageViews(range),
  ]);
  const visitors = num(s?.visitors);
  const sessions = num(s?.sessions);
  const leads = num(l?.leads);
  const qualifiedLeads = num(l?.qualified) + num(l?.wonLeads);
  return {
    visitors,
    sessions,
    pageViews: views,
    leads,
    visitorToLeadRate: pct(num(s?.leadVisitors), visitors),
    sessionToLeadRate: pct(num(s?.leadSessions), sessions),
    qualifiedLeads,
    qualificationRate: pct(qualifiedLeads, leads),
    winRate: pct(num(l?.wonLeads), leads),
    wonLeads: num(l?.wonLeads),
    leadRevenue: money(l?.leadRevenue),
    orders: num(o?.orders),
    orderRevenue: money(o?.orderRevenue),
    newVisitors: split.newVisitors,
    returningVisitors: split.returningVisitors,
  };
}

/** { value, previous, delta, deltaPct } per metric; deltaPct null when previous is 0 / null. */
function compareMetrics(current, previous) {
  const out = {};
  for (const [key, value] of Object.entries(current)) {
    const prev = previous ? previous[key] : undefined;
    if (!previous || value === null || prev === null || prev === undefined) {
      out[key] = { value, previous: previous ? prev ?? null : undefined, delta: null, deltaPct: null };
      continue;
    }
    const delta = Math.round((value - prev) * 100) / 100;
    out[key] = { value, previous: prev, delta, deltaPct: prev ? Math.round((delta / Math.abs(prev)) * 1000) / 10 : null };
  }
  return out;
}

async function getOverview({ range, compareRange = null, model = "operational", filters = {} }) {
  const [current, previous] = await Promise.all([
    overviewFor(range, model, filters),
    compareRange ? overviewFor(compareRange, model, filters) : Promise.resolve(null),
  ]);
  return {
    model,
    modelLabel: MODELS[model].label,
    filters,
    metrics: compareMetrics(current, previous),
    compare: Boolean(previous),
  };
}

// ── lead list / export ────────────────────────────────────────────────────────

const STATUSES = new Set(["new", "contacted", "qualified", "won", "lost"]);
const SORTS = {
  submittedAt: "l.submitted_at",
  status: "l.conversion_status",
  revenue: "l.revenue",
  channel: leadExpr("channel", "operational"),
  source: leadExpr("source", "operational"),
  campaign: leadExpr("campaign", "operational"),
};
const firstExpr = (field) => leadAttrExpr(field, { touch: "first", unknown: true });

/** WHERE clause for the lead list and export (same filters). */
function leadListWhere(range, q = {}) {
  const where = [];
  const replacements = {};
  const add = (sql, key, value) => {
    where.push(sql);
    replacements[key] = value;
  };
  const r = rangeSql(range, "l.submitted_at", "ll_");
  where.push(r.sql);
  Object.assign(replacements, r.replacements);
  const test = ["real", "test", "all"].includes(q.test) ? q.test : "real";
  if (test === "real") where.push("l.test_mode = 0");
  if (test === "test") where.push("l.test_mode = 1");
  // One status or several (comma-separated, e.g. "qualified,won"); unknown values are ignored.
  const statuses = [...new Set(String(q.status || "").split(",").map((v) => v.trim()).filter((v) => STATUSES.has(v)))];
  if (statuses.length) add("l.conversion_status IN (:statuses)", "statuses", statuses);
  for (const field of ["channel", "source", "medium", "campaign"]) {
    if (q[field]) add(`${leadExpr(field, "operational")} = :op_${field}`, `op_${field}`, q[field]);
  }
  if (q.landingPage) add("l.landing_page_slug = :landingPage", "landingPage", q.landingPage);
  if (q.form) add("l.form_id = :form", "form", q.form);
  if (q.firstSource) add(`${firstExpr("source")} = :firstSource`, "firstSource", q.firstSource);
  if (q.lastSource) add(`${leadAttrExpr("source", { touch: "lastAny", unknown: true })} = :lastSource`, "lastSource", q.lastSource);
  if (q.lndSource) add(`${leadAttrExpr("source", { touch: "lnd", unknown: true })} = :lndSource`, "lndSource", q.lndSource);
  if (q.q) {
    const idMatch = String(q.q).match(/^(?:sub_)?(\d+)$/);
    if (idMatch) add("l.id = :qid", "qid", Number(idMatch[1]));
    else add("CAST(l.fields AS CHAR) LIKE :qtext", "qtext", `%${String(q.q).replace(/[%_\\]/g, "\\$&")}%`);
  }
  return { sql: where.join(" AND "), replacements };
}

async function listLeads({ range, query = {} }) {
  const page = Math.max(1, Math.floor(num(query.page) || 1));
  const pageSize = Math.min(100, Math.max(10, Math.floor(num(query.pageSize) || 25)));
  const sortCol = SORTS[query.sort] || SORTS.submittedAt;
  const dir = query.dir === "asc" ? "ASC" : "DESC";
  const w = leadListWhere(range, query);
  const [countRow] = await select(`SELECT COUNT(*) AS n FROM lead_submissions l WHERE ${w.sql}`, w.replacements);
  const ids = await select(
    `SELECT l.id FROM lead_submissions l WHERE ${w.sql}
     ORDER BY ${sortCol} ${dir}, l.id ${dir} LIMIT :limit OFFSET :offset`,
    { ...w.replacements, limit: pageSize, offset: (page - 1) * pageSize },
  );
  const LeadSubmission = getLeadSubmissionModel();
  const found = ids.length ? await LeadSubmission.findAll({ where: { id: ids.map((r) => r.id) } }) : [];
  const byId = new Map(found.map((row) => [String(row.id), row]));
  const total = num(countRow?.n);
  return {
    rows: ids.map((r) => byId.get(String(r.id))).filter(Boolean).map(formatLeadRow),
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

const EXPORT_LIMIT = 10000;
const CLICK_IDS = ["gclid", "gbraid", "wbraid", "dclid", "fbclid", "msclkid", "ttclid", "liFatId", "twclid"];
const touchCols = (prefix, key) => [
  { header: `${prefix}_channel`, value: (r) => r.touches?.[key]?.channel },
  { header: `${prefix}_source`, value: (r) => r.touches?.[key]?.source },
  { header: `${prefix}_medium`, value: (r) => r.touches?.[key]?.medium },
  { header: `${prefix}_campaign`, value: (r) => r.touches?.[key]?.campaign },
];
const pick = (fields, names) => {
  const lower = Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k.toLowerCase().replace(/[\s_-]/g, ""), v]));
  for (const n of names) if (lower[n]) return lower[n];
  return "";
};

/** Columns of the lead CSV; contact details only for users allowed to see customer details. */
function leadExportColumns(withContact) {
  return [
    { header: "lead_id", value: (r) => r.id },
    { header: "created_at", value: (r) => r.createdAt || r.submittedAt },
    { header: "status", value: (r) => r.conversionStatus },
    { header: "revenue", value: (r) => r.revenue },
    ...(withContact
      ? [
        { header: "name", value: (r) => pick(r.fields, ["name", "fullname", "firstname"]) },
        { header: "email", value: (r) => pick(r.fields, ["email", "emailaddress"]) },
        { header: "phone", value: (r) => pick(r.fields, ["phone", "phonenumber", "tel", "mobile"]) },
        { header: "company", value: (r) => pick(r.fields, ["company", "companyname", "business"]) },
      ]
      : []),
    { header: "operational_channel", value: (r) => r.channel },
    { header: "operational_source", value: (r) => r.source },
    { header: "operational_medium", value: (r) => r.medium },
    { header: "operational_campaign", value: (r) => r.campaign },
    { header: "operational_content", value: (r) => r.content },
    { header: "operational_term", value: (r) => r.term },
    ...touchCols("first_touch", "first"),
    ...touchCols("last_touch", "last"),
    ...touchCols("last_non_direct", "lastNonDirect"),
    ...touchCols("session", "session"),
    ...touchCols("conversion", "conversion"),
    { header: "landing_page", value: (r) => r.landingPageSlug || r.sessionLandingPage },
    { header: "conversion_page", value: (r) => r.conversionPage || r.pageUrl },
    { header: "form_id", value: (r) => r.formId },
    { header: "section_id", value: (r) => r.sectionId },
    ...CLICK_IDS.map((k) => ({ header: k === "liFatId" ? "li_fat_id" : k, value: (r) => r.clickIds?.[k] })),
    { header: "test_mode", value: (r) => (r.testMode ? "yes" : "no") },
  ];
}

async function exportLeads({ range, query = {}, access }) {
  const w = leadListWhere(range, query);
  const ids = await select(
    `SELECT l.id FROM lead_submissions l WHERE ${w.sql} ORDER BY l.submitted_at DESC, l.id DESC LIMIT :limit`,
    { ...w.replacements, limit: EXPORT_LIMIT + 1 },
  );
  const truncated = ids.length > EXPORT_LIMIT;
  const keep = ids.slice(0, EXPORT_LIMIT).map((r) => r.id);
  const LeadSubmission = getLeadSubmissionModel();
  const rows = keep.length
    ? (await LeadSubmission.findAll({ where: { id: keep }, order: [["submittedAt", "DESC"], ["id", "DESC"]] })).map(formatLeadRow)
    : [];
  const withContact = Boolean(access?.canViewCustomerDetails);
  return { rows, columns: leadExportColumns(withContact), truncated, withContact };
}

module.exports = {
  getAcquisition,
  finishRow,
  compareMetrics,
  sessionMetrics,
  leadMetrics,
  orderMetrics,
  filterSql,
  sessionExpr,
  leadExpr,
  orderExpr,
  LEAD_STATUS_SQL,
  LEAD_COUNT_KEYS,
  REPORT_DIMENSIONS,
  GROUPINGS,
  COMBINED,
  DIMENSION_DEFAULTS,
  getOverview,
  listLeads,
  exportLeads,
  leadListWhere,
  EXPORT_LIMIT,
};
