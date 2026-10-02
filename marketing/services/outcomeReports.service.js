/**
 * Reporting Phase C — business outcomes: lead quality, revenue, the six attribution models side by
 * side, and the audience views (new vs returning, Direct, referral URLs). Definitions:
 * docs/analytics/EVENT_CONTRACT.md ("Business outcome reports (Phase C)").
 *
 * Everything builds on the shared Phase A layer (services/reports.service.js): the same period,
 * timezone, real/test/preview exclusion, attribution SQL and Unknown / (not set) buckets.
 *
 *   Lead status   CURRENT status only (lead_submissions.conversion_status; no status history is
 *                 stored and any transition is allowed) → current-state counts, never transitions.
 *   Lead revenue  the amount entered by sales on WON leads. Order revenue = paid online orders with
 *                 the order's own attribution. Leads are not linked to orders / customers, so the
 *                 two are always reported side by side and never added together.
 */
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { realSessions } = require("../utils/reportFilters");
const { MODELS, rangeSql, sqlTime } = require("../utils/reportQuery");
const reports = require("./reports.service");
const { getTiming } = require("./conversionReports.service");

const select = (sql, replacements) => getMarketingSequelize().query(sql, { replacements, type: QueryTypes.SELECT });
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (v) => Math.round(num(v) * 100) / 100;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const validation = (message) => Object.assign(new Error(message), { code: "VALIDATION_ERROR" });

// ── lead quality ──────────────────────────────────────────────────────────────

const LEAD_QUALITY_DIMENSIONS = ["channel", "source", "medium", "campaign", "content", "term", "landingPage", "campaignDetail"];

/**
 * Lead quality per dimension (selected attribution model) + the current-state status funnel.
 * Funnel stages count leads whose CURRENT status is that stage or a later one (Lead → Contacted →
 * Qualified → Won); Lost is an outcome shown beside the funnel, not a stage.
 */
async function getLeadQuality({ range, compareRange = null, model = "operational", dimension = "channel", filters = {} }) {
  if (!LEAD_QUALITY_DIMENSIONS.includes(dimension)) throw validation("Unknown dimension.");
  const data = await reports.getAcquisition({ range, compareRange, model, dimension, filters, parts: { leads: true } });
  const t = data.totals;
  const stages = [
    ["lead", "Lead", t.leads],
    ["contacted", "Contacted or later", t.reachedContacted],
    ["qualified", "Qualified or later", t.reachedQualified],
    ["won", "Won", t.wonLeads],
  ];
  const funnel = stages.map(([key, label, leads], i) => ({
    key,
    label,
    leads,
    ofLeads: pct(leads, t.leads),
    ofPrevious: i === 0 ? null : pct(leads, stages[i - 1][2]),
  }));
  const statusMix = [
    ["new", "New", t.newLeads],
    ["contacted", "Contacted", t.contacted],
    ["qualified", "Qualified", t.qualified],
    ["won", "Won", t.wonLeads],
    ["lost", "Lost", t.lost],
  ].map(([key, label, leads]) => ({ key, label, leads, share: pct(leads, t.leads) }));
  return { ...data, funnel, statusMix };
}

// ── revenue ───────────────────────────────────────────────────────────────────

const REVENUE_DIMENSIONS = ["channel", "source", "medium", "campaign", "content", "term", "campaignDetail"];

/** Lead revenue (selected model) and order revenue (the order's own attribution), side by side. */
async function getRevenue({ range, compareRange = null, model = "operational", dimension = "channel", filters = {} }) {
  if (!REVENUE_DIMENSIONS.includes(dimension)) throw validation("Unknown dimension.");
  const data = await reports.getAcquisition({ range, compareRange, model, dimension, filters, parts: { leads: true, orders: true } });
  return { ...data, orderModel: MODELS[model].orderTouch === "first" ? "first touch" : "last non-direct touch" };
}

// ── attribution comparison ────────────────────────────────────────────────────

const COMPARISON_MODELS = ["operational", "first", "last", "last_non_direct", "session", "conversion"];
const COMPARISON_DIMENSIONS = ["channel", "source", "campaign"];

/**
 * Leads, won leads and lead revenue per dimension value under all six models. One statement: the
 * lead set is read once (CTE, materialised once by MySQL) and grouped six times. Every model
 * credits each lead to exactly one value, so each model's column adds up to the same total.
 */
async function getAttributionComparison({ range, dimension = "channel" }) {
  if (!COMPARISON_DIMENSIONS.includes(dimension)) throw validation("Unknown dimension.");
  const lr = rangeSql(range, "l.submitted_at", "ac_");
  const cols = COMPARISON_MODELS.map((m, i) => `${reports.leadExpr(dimension, m)} AS m${i}`).join(",\n              ");
  const groups = COMPARISON_MODELS.map(
    // NO_MERGE: materialise the lead set once instead of MySQL inlining it into all six branches.
    (m, i) => `SELECT /*+ NO_MERGE(x) */ '${m}' AS model, m${i} AS grp, COUNT(*) AS leads, SUM(won) AS wonLeads, SUM(rev) AS leadRevenue FROM x GROUP BY m${i}`,
  ).join("\n     UNION ALL ");
  const rows = await select(
    `WITH x AS (
       SELECT ${cols},
              (l.conversion_status = 'won') AS won,
              CASE WHEN l.conversion_status = 'won' THEN COALESCE(l.revenue, 0) ELSE 0 END AS rev
       FROM lead_submissions l
       WHERE l.test_mode = 0 AND ${lr.sql}
     )
     ${groups}`,
    lr.replacements,
  );
  const empty = () => Object.fromEntries(COMPARISON_MODELS.map((m) => [m, { leads: 0, wonLeads: 0, leadRevenue: 0 }]));
  const byValue = new Map();
  const totals = empty();
  for (const r of rows) {
    const name = String(r.grp ?? "").trim() || reports.DIMENSION_DEFAULTS[dimension];
    const key = name.toLowerCase();
    if (!byValue.has(key)) byValue.set(key, { value: name, models: empty() });
    const cell = byValue.get(key).models[r.model];
    cell.leads += num(r.leads);
    cell.wonLeads += num(r.wonLeads);
    cell.leadRevenue = money(cell.leadRevenue + num(r.leadRevenue));
    totals[r.model].leads += num(r.leads);
    totals[r.model].wonLeads += num(r.wonLeads);
    totals[r.model].leadRevenue = money(totals[r.model].leadRevenue + num(r.leadRevenue));
  }
  const maxLeads = (row) => Math.max(...COMPARISON_MODELS.map((m) => row.models[m].leads));
  return {
    dimension,
    models: COMPARISON_MODELS.map((m) => ({ value: m, label: MODELS[m].label })),
    rows: [...byValue.values()].sort((a, b) => maxLeads(b) - maxLeads(a) || a.value.localeCompare(b.value)),
    totals,
  };
}

// ── Direct ────────────────────────────────────────────────────────────────────

const channelOf = (model) => reports.leadExpr("channel", model);

/** Direct numbers of one period (flat, so they can be compared). */
async function directSummary(range) {
  const lr = rangeSql(range, "l.submitted_at", "dl_");
  const [[s], [l], [o]] = await Promise.all([
    reports.sessionMetrics(range, { channel: "Direct" }, null),
    select(
      `SELECT COUNT(*) AS leads,
              SUM(x.lastAny = 'Direct') AS lastTouchDirect,
              SUM(x.op = 'Direct') AS operationalDirect,
              SUM(x.sess = 'Direct') AS sessionDirect,
              SUM(x.sess = 'Direct' AND x.op = 'Direct') AS trulyDirect,
              SUM(x.sess = 'Direct' AND x.op <> 'Direct') AS creditedEarlier,
              SUM(x.sess = 'Direct' AND x.st IN ('qualified', 'won')) AS sessionQualified,
              SUM(x.sess = 'Direct' AND x.st = 'won') AS sessionWon,
              SUM(CASE WHEN x.sess = 'Direct' AND x.st = 'won' THEN x.rev ELSE 0 END) AS sessionRevenue,
              SUM(x.sess = 'Direct' AND x.op = 'Direct' AND x.st IN ('qualified', 'won')) AS trulyQualified,
              SUM(x.sess = 'Direct' AND x.op = 'Direct' AND x.st = 'won') AS trulyWon,
              SUM(CASE WHEN x.sess = 'Direct' AND x.op = 'Direct' AND x.st = 'won' THEN x.rev ELSE 0 END) AS trulyRevenue,
              SUM(x.sess = 'Direct' AND x.op <> 'Direct' AND x.st IN ('qualified', 'won')) AS earlierQualified,
              SUM(x.sess = 'Direct' AND x.op <> 'Direct' AND x.st = 'won') AS earlierWon,
              SUM(CASE WHEN x.sess = 'Direct' AND x.op <> 'Direct' AND x.st = 'won' THEN x.rev ELSE 0 END) AS earlierRevenue
       FROM (
         SELECT ${channelOf("last")} AS lastAny, ${channelOf("operational")} AS op, ${channelOf("session")} AS sess,
                l.conversion_status AS st, COALESCE(l.revenue, 0) AS rev
         FROM lead_submissions l WHERE l.test_mode = 0 AND ${lr.sql}
       ) x`,
      lr.replacements,
    ),
    reports.orderMetrics(range, { channel: "Direct" }, "operational", null),
  ]);
  const visitors = num(s?.visitors);
  const sessions = num(s?.sessions);
  return {
    visitors,
    sessions,
    visitorToLeadRate: pct(num(s?.leadVisitors), visitors),
    sessionToLeadRate: pct(num(s?.leadSessions), sessions),
    leads: num(l?.leads),
    lastTouchDirect: num(l?.lastTouchDirect),
    operationalDirect: num(l?.operationalDirect),
    sessionDirect: num(l?.sessionDirect),
    trulyDirect: num(l?.trulyDirect),
    creditedEarlier: num(l?.creditedEarlier),
    sessionQualified: num(l?.sessionQualified),
    sessionWon: num(l?.sessionWon),
    sessionRevenue: money(l?.sessionRevenue),
    trulyQualified: num(l?.trulyQualified),
    trulyWon: num(l?.trulyWon),
    trulyRevenue: money(l?.trulyRevenue),
    earlierQualified: num(l?.earlierQualified),
    earlierWon: num(l?.earlierWon),
    earlierRevenue: money(l?.earlierRevenue),
    directOrders: num(o?.orders),
    directOrderRevenue: money(o?.orderRevenue),
  };
}

/**
 * Direct: visits that started Direct, and leads converted during a Direct visit split into truly
 * Direct (no earlier non-direct touch → Operational = Direct) and operationally credited to an
 * earlier source (Operational = last non-direct touch), with where that credit went.
 */
async function getDirect({ range, compareRange = null }) {
  const lr = rangeSql(range, "l.submitted_at", "dc_");
  const [current, previous, credited] = await Promise.all([
    directSummary(range),
    compareRange ? directSummary(compareRange) : Promise.resolve(null),
    select(
      // Aliases differ from the lead columns (GROUP BY would bind channel / source / campaign to them).
      `SELECT ${channelOf("operational")} AS opChannel, ${reports.leadExpr("source", "operational")} AS opSource,
              ${reports.leadExpr("campaign", "operational")} AS opCampaign,
              COUNT(*) AS leads, SUM(l.conversion_status = 'won') AS wonLeads,
              SUM(CASE WHEN l.conversion_status = 'won' THEN COALESCE(l.revenue, 0) ELSE 0 END) AS leadRevenue
       FROM lead_submissions l
       WHERE l.test_mode = 0 AND ${lr.sql} AND ${channelOf("session")} = 'Direct' AND ${channelOf("operational")} <> 'Direct'
       GROUP BY opChannel, opSource, opCampaign ORDER BY leads DESC, opChannel LIMIT 50`,
      lr.replacements,
    ),
  ]);
  return {
    summary: current,
    comparison: previous ? reports.compareMetrics(current, previous) : null,
    creditedTo: credited.map((r) => ({
      channel: r.opChannel,
      source: r.opSource,
      campaign: r.opCampaign,
      leads: num(r.leads),
      wonLeads: num(r.wonLeads),
      leadRevenue: money(r.leadRevenue),
    })),
  };
}

// ── new vs returning ──────────────────────────────────────────────────────────

/**
 * Visitor type of a visitor-id column, as of the period end (the Phase A definition): New = one
 * real visit up to the end of the period, Returning = two or more; no visitor / no recorded visit
 * → unknown. The same rule classifies visitors, leads and orders, so the groups add up.
 */
function visitorTypeSql(visitorCol, range, prefix) {
  const upTo = range?.end ? `AND vt.started_at < :${prefix}end` : "";
  return {
    sql: `(CASE WHEN ${visitorCol} IS NULL THEN 'unknown' ELSE (
             SELECT CASE WHEN COUNT(*) = 0 THEN 'unknown' WHEN COUNT(*) = 1 THEN 'new' ELSE 'returning' END
             FROM marketing_sessions vt WHERE vt.visitor_id = ${visitorCol} AND ${realSessions("vt")} ${upTo}) END)`,
    replacements: range?.end ? { [`${prefix}end`]: sqlTime(range.end) } : {},
  };
}

const VISITOR_TYPES = [["new", "New visitors"], ["returning", "Returning visitors"], ["unknown", "Not linked to a recorded visit"]];

async function newReturningFor(range) {
  const r = rangeSql(range, "s.started_at", "nv_");
  const lrS = rangeSql(range, "l.submitted_at", "nls_");
  const lrV = rangeSql(range, "l.submitted_at", "nlv_");
  const lr = rangeSql(range, "l.submitted_at", "nl_");
  const or = rangeSql(range, "m.paid_at", "no_");
  const upTo = range?.end ? "AND s2.started_at < :nv_end" : "";
  const visitorsCte = `v AS (
       SELECT a.visitor_id, COUNT(DISTINCT s2.session_id) AS n
       FROM (SELECT DISTINCT s.visitor_id FROM marketing_sessions s WHERE ${realSessions("s")} AND ${r.sql}) a
       JOIN marketing_sessions s2 ON s2.visitor_id = a.visitor_id AND ${realSessions("s2")} ${upTo}
       GROUP BY a.visitor_id
     )`;
  const vtLead = visitorTypeSql("l.visitor_id", range, "nvl_");
  const vtOrder = visitorTypeSql("m.visitor_id", range, "nvo_");
  const [visits, avgVisits, leads, orders] = await Promise.all([
    select(
      `WITH ${visitorsCte}
       SELECT CASE WHEN v.n >= 2 THEN 'returning' ELSE 'new' END AS grp,
              COUNT(DISTINCT s.visitor_id) AS visitors, COUNT(*) AS sessions,
              SUM(ls.session_id IS NOT NULL) AS leadSessions,
              COUNT(DISTINCT CASE WHEN lv.visitor_id IS NOT NULL THEN s.visitor_id END) AS leadVisitors
       FROM marketing_sessions s
       JOIN v ON v.visitor_id = s.visitor_id
       LEFT JOIN (SELECT DISTINCT l.session_id FROM lead_submissions l
                  WHERE l.test_mode = 0 AND ${lrS.sql} AND l.session_id IS NOT NULL) ls ON ls.session_id = s.session_id
       LEFT JOIN (SELECT DISTINCT l.visitor_id FROM lead_submissions l
                  WHERE l.test_mode = 0 AND ${lrV.sql} AND l.visitor_id IS NOT NULL) lv ON lv.visitor_id = s.visitor_id
       WHERE ${realSessions("s")} AND ${r.sql}
       GROUP BY grp`,
      { ...r.replacements, ...lrS.replacements, ...lrV.replacements },
    ),
    select(
      `WITH ${visitorsCte}
       SELECT CASE WHEN v.n >= 2 THEN 'returning' ELSE 'new' END AS grp, AVG(v.n) AS avgVisits FROM v GROUP BY grp`,
      r.replacements,
    ),
    select(
      `SELECT ${vtLead.sql} AS grp, COUNT(*) AS leads, ${reports.LEAD_STATUS_SQL}
       FROM lead_submissions l WHERE l.test_mode = 0 AND ${lr.sql} GROUP BY grp`,
      { ...lr.replacements, ...vtLead.replacements },
    ),
    select(
      `SELECT ${vtOrder.sql} AS grp, COUNT(*) AS orders, SUM(m.revenue) AS orderRevenue
       FROM marketing_order_attribution m WHERE m.status = 'paid' AND ${or.sql} GROUP BY grp`,
      { ...or.replacements, ...vtOrder.replacements },
    ),
  ]);
  const rows = new Map(VISITOR_TYPES.map(([key, label]) => [key, {
    key, value: label, visitors: 0, sessions: 0, leadVisitors: 0, leadSessions: 0,
    leads: 0, newLeads: 0, contacted: 0, qualified: 0, wonLeads: 0, lost: 0, wonWithRevenue: 0, leadRevenue: 0, orders: 0, orderRevenue: 0,
    averageVisitsPerVisitor: null,
  }]));
  for (const x of visits) {
    const row = rows.get(x.grp);
    for (const k of ["visitors", "sessions", "leadSessions", "leadVisitors"]) row[k] = num(x[k]);
  }
  for (const x of avgVisits) rows.get(x.grp).averageVisitsPerVisitor = Math.round(num(x.avgVisits) * 10) / 10;
  for (const x of leads) {
    const row = rows.get(x.grp);
    for (const k of reports.LEAD_COUNT_KEYS) row[k] = num(x[k]);
    row.leadRevenue = num(x.leadRevenue);
  }
  for (const x of orders) {
    const row = rows.get(x.grp);
    row.orders = num(x.orders);
    row.orderRevenue = num(x.orderRevenue);
  }
  const totalLeads = [...rows.values()].reduce((a, x) => a + x.leads, 0);
  const out = [...rows.values()].map((x) => reports.finishRow(x, totalLeads));
  // The "unknown" group exists only for leads / orders without a recorded visit.
  return out.filter((x) => x.key !== "unknown" || x.leads > 0 || x.orders > 0);
}

/**
 * New vs returning visitors: visits, leads, lead quality, lead / order revenue and conversion
 * behaviour (Phase B timing grouped by the same visitor type). Visitor-level, so no attribution
 * model applies.
 */
async function getNewReturning({ range, compareRange = null }) {
  const vt = visitorTypeSql("l.visitor_id", range, "nrt_");
  const [rows, previous, timing] = await Promise.all([
    newReturningFor(range),
    compareRange ? newReturningFor(compareRange) : Promise.resolve(null),
    getTiming({ range, groupBy: vt }),
  ]);
  const behaviour = VISITOR_TYPES.filter(([key]) => key !== "unknown").map(([key, label]) => {
    const g = timing.segments.find((s) => s.segment === key);
    return {
      key,
      value: label,
      leads: g ? g.leads : 0,
      completeHistory: g ? g.history.complete : 0,
      medianSeconds: g ? g.time.medianSeconds : null,
      medianSessions: g ? g.sessions.median : null,
      sameSessionRate: g ? g.sessions.sameSessionRate : null,
    };
  });
  const COMPARED = ["visitors", "sessions", "leads", "visitorToLeadRate", "sessionToLeadRate", "reachedQualified", "wonLeads", "leadRevenue", "orderRevenue"];
  const comparison = previous
    ? Object.fromEntries(rows.map((row) => {
      const prev = previous.find((p) => p.key === row.key) || null;
      const pick = (x) => (x ? Object.fromEntries(COMPARED.map((k) => [k, x[k] ?? null])) : Object.fromEntries(COMPARED.map((k) => [k, 0])));
      return [row.key, reports.compareMetrics(pick(row), pick(prev))];
    }))
    : null;
  return { rows, behaviour, comparison };
}

// ── referral URLs (on demand) ─────────────────────────────────────────────────

/**
 * Referring URLs of one referral source (sessions only; query strings dropped — they can carry
 * tokens). Loaded only when a referral row is opened: URLs are high-cardinality.
 */
async function getReferrerUrls({ range, source, limit = 50 }) {
  const r = rangeSql(range, "s.started_at", "ru_");
  const lr = rangeSql(range, "l.submitted_at", "rul_");
  const url = "COALESCE(NULLIF(SUBSTRING_INDEX(SUBSTRING_INDEX(s.referrer, '?', 1), '#', 1), ''), '(not recorded)')";
  const where = `${realSessions("s")} AND ${r.sql} AND s.channel = 'Referral' AND s.source = :ru_source`;
  const reps = { ...r.replacements, ...lr.replacements, ru_source: source, ru_limit: Math.min(200, Math.max(1, limit)) };
  const [rows, [count]] = await Promise.all([
    select(
      `SELECT ${url} AS url, COUNT(*) AS sessions, COUNT(DISTINCT s.visitor_id) AS visitors, SUM(ls.session_id IS NOT NULL) AS leadSessions
       FROM marketing_sessions s
       LEFT JOIN (SELECT DISTINCT l.session_id FROM lead_submissions l
                  WHERE l.test_mode = 0 AND ${lr.sql} AND l.session_id IS NOT NULL) ls ON ls.session_id = s.session_id
       WHERE ${where}
       GROUP BY url ORDER BY sessions DESC, url LIMIT :ru_limit`,
      reps,
    ),
    select(`SELECT COUNT(DISTINCT ${url}) AS n FROM marketing_sessions s WHERE ${where}`, reps),
  ]);
  return {
    source,
    urls: rows.map((x) => ({ url: x.url, sessions: num(x.sessions), visitors: num(x.visitors), leadSessions: num(x.leadSessions), sessionToLeadRate: pct(num(x.leadSessions), num(x.sessions)) })),
    distinctUrls: num(count?.n),
  };
}

// ── devices ───────────────────────────────────────────────────────────────────

const DEVICE_DIMENSIONS = reports.DEVICE_DIMENSIONS;

/**
 * Visits, leads and lead outcomes by device type / operating system / browser (Audience ›
 * Devices). Visits use the device of their first page view; leads the device they were submitted
 * from (so visitor → lead counts the visitors of that device who submitted a lead anywhere).
 */
async function getDevices({ range, compareRange = null, model = "operational", dimension = "deviceType", filters = {} }) {
  if (!DEVICE_DIMENSIONS.includes(dimension)) throw validation("Unknown dimension.");
  const data = await reports.getAcquisition({ range, compareRange, model, dimension, filters, parts: { sessions: true, leads: true } });
  const rows = data.rows.map((r) => ({ ...r, sessionShare: pct(r.sessions, data.totals.sessions), leadShare: pct(r.leads, data.totals.leads) }));
  return { ...data, rows };
}

module.exports = {
  getDevices,
  DEVICE_DIMENSIONS,
  getLeadQuality,
  getRevenue,
  getAttributionComparison,
  getDirect,
  getNewReturning,
  getReferrerUrls,
  LEAD_QUALITY_DIMENSIONS,
  REVENUE_DIMENSIONS,
  COMPARISON_DIMENSIONS,
  COMPARISON_MODELS,
};
