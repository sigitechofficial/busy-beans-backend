/**
 * Reporting Phase B — conversion behaviour: forms, CTAs, ordered funnel, conversion timing
 * (time + sessions before conversion) and trends. Definitions: docs/analytics/EVENT_CONTRACT.md
 * ("Conversion reports"). Shared rules: utils/reportQuery (period, filters, buckets, form keys),
 * utils/reportFilters (real traffic), utils/leadAttributionSql (lead model).
 *
 * Scope conventions
 *   Event reports (forms, CTAs, funnel, trends): real events / sessions in the period; drill
 *     filters and segments use the SESSION's acquisition touch (how the visit started) and the
 *     session's entry landing page — the attribution model does not apply to them.
 *   Lead-level reports (timing): real leads submitted in the period; filters and segments use
 *     the selected attribution model (like Phase A).
 *   "Lead after X": a real lead in the same session submitted no earlier than X (2 minutes of
 *     clock tolerance, the same skew the ingest accepts for browser timestamps).
 * Everything is aggregated in SQL (no journeys loaded into Node).
 */
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getLandingPageModel } = require("../models/landingPage");
const { leadAttrExpr, UNKNOWN_DEFAULTS } = require("../utils/leadAttributionSql");
const { realEvents, realSessions } = require("../utils/reportFilters");
const { MODELS, rangeSql, bucketCase, formKeySql, trendBuckets } = require("../utils/reportQuery");
const { localDateOf } = require("../utils/businessTime");
const { filterSql, orderExpr } = require("./reports.service");

const select = (sql, replacements) => getMarketingSequelize().query(sql, { replacements, type: QueryTypes.SELECT });
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const SKEW = "INTERVAL 2 MINUTE";
const CTA_TYPES = ["cta_click", "phone_click", "email_click", "whatsapp_click"];
const CTA_TYPE_SQL = `('${CTA_TYPES.join("','")}')`;
const CTA_KIND = { cta_click: "Standard", phone_click: "Phone", email_click: "Email", whatsapp_click: "WhatsApp" };
const NO_LP = "(not a landing page)";

const meta = (alias, key) => `NULLIF(JSON_UNQUOTE(JSON_EXTRACT(${alias}.metadata, '$.${key}')), '')`;
const eventFormKey = (a = "e") => formKeySql(`COALESCE(${meta(a, "form_id")}, ${meta(a, "formId")})`);
const leadFormKey = (a = "l") => formKeySql(`${a}.form_id`);

// ── scopes ────────────────────────────────────────────────────────────────────

/** Session acquisition expression for a filter / segment. */
function sessionDim(dim, a = "s") {
  if (dim === "landingPage") return `COALESCE(NULLIF(${a}.entry_landing_page_slug, ''), '${NO_LP}')`;
  return `COALESCE(NULLIF(${a}.${dim}, ''), '${UNKNOWN_DEFAULTS[dim]}')`;
}
/** Lead expression for a filter / segment under the attribution model. */
function leadDim(dim, model, a = "l") {
  if (dim === "landingPage") return `COALESCE(NULLIF(${a}.landing_page_slug, ''), '${NO_LP}')`;
  return leadAttrExpr(dim, { touch: MODELS[model].touch, unknown: true, alias: a });
}

/** WHERE fragment for drill filters + landing page on a session alias. */
function sessionFilters(filters, a = "s", prefix = "sf") {
  const parts = [];
  const replacements = {};
  for (const [dim, value] of Object.entries(filters || {})) {
    if (value === undefined) continue;
    parts.push(`${sessionDim(dim, a)} = :${prefix}_${dim}`);
    replacements[`${prefix}_${dim}`] = value;
  }
  return { sql: parts.length ? ` AND ${parts.join(" AND ")}` : "", replacements, any: parts.length > 0 };
}
function leadFilters(filters, model, a = "l", prefix = "lf") {
  const parts = [];
  const replacements = {};
  for (const [dim, value] of Object.entries(filters || {})) {
    if (value === undefined) continue;
    parts.push(`${leadDim(dim, model, a)} = :${prefix}_${dim}`);
    replacements[`${prefix}_${dim}`] = value;
  }
  return { sql: parts.length ? ` AND ${parts.join(" AND ")}` : "", replacements };
}

// ── forms ─────────────────────────────────────────────────────────────────────

/** Readable labels for landing-page lead-form sections (section heading / type), keyed by form key. */
async function sectionLabels(pageSlugs) {
  const slugs = [...new Set(pageSlugs.filter(Boolean))].slice(0, 200);
  if (!slugs.length) return new Map();
  const pages = await getLandingPageModel().findAll({ where: { slug: slugs } }).catch(() => []);
  const labels = new Map();
  const norm = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  for (const page of pages) {
    const sections = page.publishedSections || page.draftSections || [];
    for (const section of Array.isArray(sections) ? sections : []) {
      if (!section?.id) continue;
      const c = section.content || {};
      const title = [c.formTitle, c.heading, c.title, c.headline].find((t) => typeof t === "string" && t.trim());
      const type = String(section.type || "section").replace(/[-_]+/g, " ");
      labels.set(`${page.slug}|${norm(section.id)}`, title ? `${title.trim().slice(0, 80)} (${type})` : type);
    }
  }
  return labels;
}

/**
 * Forms per (form, page): views / starts / submits (events and unique sessions), leads, and
 * session-based rates. With `segment`, rows are split by the session acquisition dimension.
 */
async function getForms({ range, filters = {}, segment = null, form = null, page = null }) {
  const r = rangeSql(range, "e.timestamp", "fe_");
  const lr = rangeSql(range, "l.submitted_at", "fl_");
  const sf = sessionFilters(filters, "s", "fsf");
  const sfl = sessionFilters(filters, "ls2", "fsl");
  const seg = segment ? sessionDim(segment, "s") : null;
  const segL = segment ? sessionDim(segment, "ls2") : null;
  const scope = [];
  const scopeReps = {};
  if (form) {
    scope.push(`${eventFormKey()} = :formKey`);
    scopeReps.formKey = form;
  }
  if (page) {
    scope.push("e.page_slug = :pageSlug");
    scopeReps.pageSlug = page;
  }
  const needSession = sf.any || Boolean(seg);
  // Two levels: per (form, page, session) first, so every rate is "sessions that did both ÷
  // sessions that did the first" (≤ 100%) and each session counts once per step.
  const events = await select(
    `SELECT formKey, page, MAX(pageType) AS pageType, MAX(rawFormId) AS rawFormId, ${seg ? "segment," : ""}
            SUM(v) AS views, SUM(v > 0) AS viewSessions,
            SUM(st) AS starts, SUM(st > 0) AS startSessions,
            SUM(sb) AS submits, SUM(sb > 0) AS submitSessions,
            SUM(v > 0 AND st > 0) AS viewStartSessions,
            SUM(st > 0 AND sb > 0) AS startSubmitSessions,
            SUM(st > 0 AND hasLead) AS startLeadSessions,
            SUM(sb > 0 AND hasLead) AS submitLeadSessions
     FROM (
       SELECT ${eventFormKey()} AS formKey, COALESCE(e.page_slug, '(unknown)') AS page, e.session_id,
              MAX(e.page_type) AS pageType,
              MAX(COALESCE(${meta("e", "form_id")}, ${meta("e", "formId")})) AS rawFormId,
              ${seg ? `${seg} AS segment,` : ""}
              SUM(e.event_type = 'form_view') AS v,
              SUM(e.event_type = 'form_start') AS st,
              SUM(e.event_type = 'form_submit') AS sb,
              MAX(ls.session_id IS NOT NULL) AS hasLead
       FROM marketing_analytics_events e
       ${needSession ? "JOIN marketing_sessions s ON s.session_id = e.session_id" : ""}
       LEFT JOIN (SELECT DISTINCT l.session_id, ${leadFormKey()} AS leadFormKey FROM lead_submissions l
                  WHERE l.test_mode = 0 AND l.session_id IS NOT NULL AND ${lr.sql}) ls
         ON ls.session_id = e.session_id AND ls.leadFormKey = ${eventFormKey()}
       WHERE e.event_type IN ('form_view', 'form_start', 'form_submit') AND ${realEvents("e")} AND ${r.sql}${sf.sql}
         ${scope.length ? `AND ${scope.join(" AND ")}` : ""}
       GROUP BY formKey, page, e.session_id${seg ? ", segment" : ""}
     ) per_session
     GROUP BY formKey, page${seg ? ", segment" : ""}`,
    { ...r.replacements, ...lr.replacements, ...sf.replacements, ...scopeReps },
  );
  const leadScope = [];
  if (form) leadScope.push(`${leadFormKey()} = :formKey`);
  if (page) leadScope.push("l.page_slug = :pageSlug");
  const needLeadSession = sfl.any || Boolean(segL);
  const leads = await select(
    `SELECT ${leadFormKey()} AS formKey, COALESCE(l.page_slug, '(unknown)') AS page, MAX(l.page_type) AS pageType,
            MAX(l.form_id) AS rawFormId, MAX(l.section_id) AS sectionId,
            ${segL ? `${segL} AS segment,` : ""}
            COUNT(*) AS leads
     FROM lead_submissions l
     ${needLeadSession ? "JOIN marketing_sessions ls2 ON ls2.session_id = l.session_id" : ""}
     WHERE l.test_mode = 0 AND ${lr.sql}${sfl.sql}
       ${leadScope.length ? `AND ${leadScope.join(" AND ")}` : ""}
     GROUP BY formKey, page${segL ? ", segment" : ""}`,
    { ...lr.replacements, ...sfl.replacements, ...scopeReps },
  );

  const rows = new Map();
  const rowFor = (r0) => {
    const key = `${r0.formKey}|${r0.page}|${r0.segment ?? ""}`;
    if (!rows.has(key)) {
      rows.set(key, {
        formKey: r0.formKey, formId: null, sectionId: null, page: r0.page, pageType: r0.pageType || null, segment: r0.segment ?? null,
        views: 0, viewSessions: 0, starts: 0, startSessions: 0, submits: 0, submitSessions: 0,
        viewStartSessions: 0, startSubmitSessions: 0, startLeadSessions: 0, submitLeadSessions: 0, leads: 0,
      });
    }
    return rows.get(key);
  };
  for (const e of events) {
    const row = rowFor(e);
    row.formId = row.formId || e.rawFormId || null;
    for (const k of ["views", "viewSessions", "starts", "startSessions", "submits", "submitSessions", "viewStartSessions", "startSubmitSessions", "startLeadSessions", "submitLeadSessions"]) row[k] += num(e[k]);
  }
  for (const l of leads) {
    const row = rowFor(l);
    row.formId = l.rawFormId || row.formId;
    row.sectionId = l.sectionId || row.sectionId;
    row.pageType = row.pageType || l.pageType || null;
    row.leads += num(l.leads);
  }
  const labels = await sectionLabels([...rows.values()].filter((x) => x.pageType === "landing_page").map((x) => x.page));
  const out = [...rows.values()].map((x) => ({
    ...x,
    label: labels.get(`${x.page}|${x.formKey}`) || null,
    viewToStartRate: pct(x.viewStartSessions, x.viewSessions),
    startToSubmitRate: pct(x.startSubmitSessions, x.startSessions),
    startToLeadRate: pct(x.startLeadSessions, x.startSessions),
    submitToLeadRate: pct(x.submitLeadSessions, x.submitSessions),
  }));
  out.sort((a, b) => b.leads - a.leads || b.startSessions - a.startSessions || a.formKey.localeCompare(b.formKey));
  const totals = out.reduce(
    (t, x) => {
      for (const k of ["views", "starts", "submits", "leads"]) t[k] += x[k];
      return t;
    },
    { views: 0, starts: 0, submits: 0, leads: 0 },
  );
  return { rows: out, totals, segment };
}

// ── CTAs ──────────────────────────────────────────────────────────────────────

/**
 * CTAs per (type, name, location, page): clicks, unique sessions clicking, sessions with a lead
 * after the click in the same session (primary), and sessions whose visitor submitted a lead in
 * a LATER session within the period (assisted, reported separately).
 */
async function getCtas({ range, filters = {} }) {
  const r = rangeSql(range, "e.timestamp", "ce_");
  const lr = rangeSql(range, "l.submitted_at", "cl_");
  const la = rangeSql(range, "l2.submitted_at", "ca_");
  const sf = sessionFilters(filters, "s", "csf");
  const name = `COALESCE(${meta("e", "cta_name")}, ${meta("e", "label")}, '(not set)')`;
  const location = `COALESCE(${meta("e", "cta_location")}, '(not set)')`;
  const rows = await select(
    `SELECT e.event_type AS type, ${name} AS name, ${location} AS location, COALESCE(e.page_slug, '(unknown)') AS page,
            MAX(e.page_type) AS pageType, COUNT(*) AS clicks,
            COUNT(DISTINCT e.session_id) AS sessions,
            COUNT(DISTINCT CASE WHEN EXISTS (
              SELECT 1 FROM lead_submissions l
              WHERE l.session_id = e.session_id AND l.test_mode = 0 AND ${lr.sql}
                AND l.submitted_at >= e.timestamp - ${SKEW}) THEN e.session_id END) AS leadSessions,
            COUNT(DISTINCT CASE WHEN EXISTS (
              SELECT 1 FROM lead_submissions l2
              WHERE l2.visitor_id = e.visitor_id AND l2.session_id <> e.session_id AND l2.test_mode = 0 AND ${la.sql}
                AND l2.submitted_at > e.timestamp) THEN e.session_id END) AS laterSessions
     FROM marketing_analytics_events e
     ${sf.any ? "JOIN marketing_sessions s ON s.session_id = e.session_id" : ""}
     WHERE e.event_type IN ${CTA_TYPE_SQL} AND ${realEvents("e")} AND ${r.sql}${sf.sql}
     GROUP BY type, name, location, page`,
    { ...r.replacements, ...lr.replacements, ...la.replacements, ...sf.replacements },
  );
  const out = rows
    .map((x) => {
      const clicks = num(x.clicks);
      const sessions = num(x.sessions);
      const leadSessions = num(x.leadSessions);
      return {
        type: x.type,
        kind: CTA_KIND[x.type] || "Standard",
        name: x.name,
        location: x.location,
        page: x.page,
        pageType: x.pageType || null,
        clicks,
        sessions,
        leadSessions,
        ctaToLeadRate: pct(leadSessions, sessions),
        laterLeadSessions: num(x.laterSessions),
      };
    })
    .sort((a, b) => b.sessions - a.sessions || b.clicks - a.clicks);
  const byKind = {};
  for (const x of out) {
    byKind[x.kind] = byKind[x.kind] || { kind: x.kind, clicks: 0, rows: 0 };
    byKind[x.kind].clicks += x.clicks;
    byKind[x.kind].rows += 1;
  }
  return { rows: out, byKind: Object.values(byKind) };
}

// ── ordered funnel ────────────────────────────────────────────────────────────

const FUNNEL_SCOPES = {
  landing: { label: "Landing page view", types: "('landing_page_view')" },
  any: { label: "Page view", types: "('page_view', 'landing_page_view')" },
};

/**
 * Session-ordered funnel: Session → (landing) page view → CTA click → form start → form submit →
 * lead. A session passes a step only when that event happened at / after the previous step's
 * time; each session counts once per step. `segment` splits every step by the session's
 * acquisition dimension (or entry landing page).
 */
async function getFunnel({ range, filters = {}, segment = null, scope = "landing" }) {
  const sc = FUNNEL_SCOPES[scope] || FUNNEL_SCOPES.landing;
  const r = rangeSql(range, "s.started_at", "fs_");
  const sf = sessionFilters(filters, "s", "fnf");
  const seg = segment ? sessionDim(segment, "s") : "'all'";
  const rows = await select(
    `WITH base AS (
       SELECT s.session_id, ${seg} AS seg FROM marketing_sessions s
       WHERE ${realSessions("s")} AND ${r.sql}${sf.sql}
     ),
     t1 AS (
       SELECT b.session_id, MIN(e.timestamp) AS t FROM base b
       JOIN marketing_analytics_events e ON e.session_id = b.session_id
       WHERE e.event_type IN ${sc.types} AND ${realEvents("e")} GROUP BY b.session_id
     ),
     t2 AS (
       SELECT t1.session_id, MIN(e.timestamp) AS t FROM t1
       JOIN marketing_analytics_events e ON e.session_id = t1.session_id AND e.timestamp >= t1.t
       WHERE e.event_type IN ${CTA_TYPE_SQL} GROUP BY t1.session_id
     ),
     t3 AS (
       SELECT t2.session_id, MIN(e.timestamp) AS t FROM t2
       JOIN marketing_analytics_events e ON e.session_id = t2.session_id AND e.timestamp >= t2.t
       WHERE e.event_type = 'form_start' GROUP BY t2.session_id
     ),
     t4 AS (
       SELECT t3.session_id, MIN(e.timestamp) AS t FROM t3
       JOIN marketing_analytics_events e ON e.session_id = t3.session_id AND e.timestamp >= t3.t
       WHERE e.event_type = 'form_submit' GROUP BY t3.session_id
     ),
     t5 AS (
       SELECT DISTINCT t4.session_id FROM t4
       JOIN lead_submissions l ON l.session_id = t4.session_id AND l.test_mode = 0 AND l.submitted_at >= t4.t - ${SKEW}
     )
     SELECT base.seg AS segment,
            COUNT(*) AS s0,
            COUNT(t1.session_id) AS s1,
            COUNT(t2.session_id) AS s2,
            COUNT(t3.session_id) AS s3,
            COUNT(t4.session_id) AS s4,
            COUNT(t5.session_id) AS s5
     FROM base
     LEFT JOIN t1 ON t1.session_id = base.session_id
     LEFT JOIN t2 ON t2.session_id = base.session_id
     LEFT JOIN t3 ON t3.session_id = base.session_id
     LEFT JOIN t4 ON t4.session_id = base.session_id
     LEFT JOIN t5 ON t5.session_id = base.session_id
     GROUP BY base.seg`,
    { ...r.replacements, ...sf.replacements },
  );
  const labels = ["Sessions", sc.label, "CTA click", "Form start", "Form submit", "Lead"];
  const build = (x) => {
    const counts = [x.s0, x.s1, x.s2, x.s3, x.s4, x.s5].map(num);
    return {
      segment: x.segment,
      steps: labels.map((label, i) => ({
        step: label,
        sessions: counts[i],
        fromPrevious: i === 0 ? null : pct(counts[i], counts[i - 1]),
        dropOff: i === 0 ? null : counts[i - 1] - counts[i],
        cumulative: pct(counts[i], counts[0]),
      })),
    };
  };
  const segments = rows.map(build).sort((a, b) => b.steps[0].sessions - a.steps[0].sessions);
  // Overall (sum of segments = every session exactly once).
  const total = { segment: "all", s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };
  for (const x of rows) for (const k of ["s0", "s1", "s2", "s3", "s4", "s5"]) total[k] += num(x[k]);
  return { scope: scope in FUNNEL_SCOPES ? scope : "landing", segment, overall: build(total), segments: segment ? segments : [] };
}

// ── conversion timing ─────────────────────────────────────────────────────────

const TIME_BUCKETS = [
  ["same_session", "Same session"],
  ["lt_1d", "< 1 day"],
  ["d1_3", "1–3 days"],
  ["d4_7", "4–7 days"],
  ["d8_30", "8–30 days"],
  ["d31_90", "31–90 days"],
  ["d90p", "90+ days"],
];
const SESSION_BUCKETS = [["s1", "1 session"], ["s2", "2 sessions"], ["s3", "3 sessions"], ["s4_5", "4–5 sessions"], ["s6p", "6+ sessions"]];
const isoTime = (expr) => `CAST(REPLACE(REPLACE(${expr}, 'T', ' '), 'Z', '') AS DATETIME(3))`;
const touchTime = (col) => `COALESCE(${isoTime(`JSON_UNQUOTE(JSON_EXTRACT(${col}, '$.receivedAt'))`)}, ${isoTime(`JSON_UNQUOTE(JSON_EXTRACT(${col}, '$.timestamp'))`)})`;

/**
 * Per-lead timing CTE. history:
 *   complete  the lead's session is recorded and the visitor has a server first touch (tracked
 *             since the attribution model) → sessions + time are exact
 *   partial   the lead's session is recorded but the visitor predates first-touch tracking →
 *             earlier visits may be missing; excluded from averages / medians
 *   unknown   no recorded session for the lead (no visitor / session id, or not tracked)
 * sessions  distinct real sessions of the visitor that started up to the lead's session
 * seconds   lead time − first-touch time (first touch received / clicked; else the visitor's first
 *           recorded session) — only for complete history
 */
function perLeadSql({ range, filters, model, segment, groupBy = null }) {
  const lr = rangeSql(range, "l.submitted_at", "tl_");
  const lf = leadFilters(filters, model, "l", "tlf");
  const seg = groupBy ? groupBy.sql : segment ? leadDim(segment, model) : "'all'";
  const firstSource = leadAttrExpr("source", { touch: "first", unknown: true });
  const sessionSource = `LOWER(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.session_touch, '$.source')), ''))`;
  return {
    sql: `pl AS (
      SELECT x.*,
             CASE WHEN x.history <> 'complete' THEN NULL
                  ELSE GREATEST(0, TIMESTAMPDIFF(SECOND, COALESCE(x.firstTouchAt, x.firstSessionAt), x.submittedAt)) END AS seconds,
             CASE WHEN x.history = 'complete' THEN x.nSessions END AS sessionsBefore
      FROM (
        SELECT l.id, ${seg} AS seg, l.submitted_at AS submittedAt,
               COALESCE(${touchTime("v.first_touch")}, ${touchTime("l.first_touch")}) AS firstTouchAt,
               (SELECT MIN(s1.started_at) FROM marketing_sessions s1 WHERE s1.visitor_id = l.visitor_id AND ${realSessions("s1")}) AS firstSessionAt,
               (SELECT COUNT(*) FROM marketing_sessions s2
                  WHERE s2.visitor_id = l.visitor_id AND s2.started_at <= ls.started_at AND ${realSessions("s2")}) AS nSessions,
               CASE WHEN ls.session_id IS NULL THEN 'unknown'
                    WHEN v.first_touch IS NULL THEN 'partial'
                    ELSE 'complete' END AS history,
               CASE WHEN ${firstSource} = '(not set)' OR ${sessionSource} IS NULL THEN 'unknown'
                    WHEN LOWER(${firstSource}) = ${sessionSource} THEN 'single' ELSE 'multi' END AS journey
        FROM lead_submissions l
        LEFT JOIN marketing_sessions ls ON ls.session_id = l.session_id
        LEFT JOIN marketing_visitors v ON v.visitor_id = l.visitor_id
        WHERE l.test_mode = 0 AND ${lr.sql}${lf.sql}
      ) x
    )`,
    replacements: { ...lr.replacements, ...lf.replacements, ...(groupBy?.replacements || {}) },
  };
}

const TIME_BUCKET_SQL = `CASE WHEN sessionsBefore = 1 THEN 'same_session'
  WHEN seconds < 86400 THEN 'lt_1d' WHEN seconds < 4*86400 THEN 'd1_3' WHEN seconds < 8*86400 THEN 'd4_7'
  WHEN seconds < 31*86400 THEN 'd8_30' WHEN seconds < 91*86400 THEN 'd31_90' ELSE 'd90p' END`;
const SESSION_BUCKET_SQL = `CASE WHEN sessionsBefore = 1 THEN 's1' WHEN sessionsBefore = 2 THEN 's2' WHEN sessionsBefore = 3 THEN 's3'
  WHEN sessionsBefore <= 5 THEN 's4_5' ELSE 's6p' END`;

/**
 * @param groupBy  optional custom lead grouping { sql, replacements } over lead alias `l`
 *   (e.g. new vs returning visitor); replaces `segment` and skips the overall re-query.
 */
async function getTiming({ range, filters = {}, model = "operational", segment = null, groupBy = null }) {
  const pl = perLeadSql({ range, filters, model, segment, groupBy });
  const summary = await select(
    `WITH ${pl.sql}
     SELECT seg AS segment, COUNT(*) AS leads,
            SUM(history = 'complete') AS complete, SUM(history = 'partial') AS partial, SUM(history = 'unknown') AS unknownHistory,
            AVG(seconds) AS avgSeconds, AVG(sessionsBefore) AS avgSessions,
            SUM(sessionsBefore = 1) AS sameSession, SUM(sessionsBefore > 1) AS multiSession,
            SUM(journey = 'single') AS singleSource, SUM(journey = 'multi') AS multiSource
     FROM pl GROUP BY seg`,
    pl.replacements,
  );
  const medians = async (column) => {
    const rows = await select(
      `WITH ${pl.sql}
       SELECT seg AS segment, AVG(v) AS median FROM (
         SELECT seg, ${column} AS v,
                ROW_NUMBER() OVER (PARTITION BY seg ORDER BY ${column}) AS rn,
                COUNT(*) OVER (PARTITION BY seg) AS c
         FROM pl WHERE ${column} IS NOT NULL
       ) m WHERE rn IN (FLOOR((c + 1) / 2), FLOOR((c + 2) / 2)) GROUP BY seg`,
      pl.replacements,
    );
    return new Map(rows.map((x) => [x.segment, Number(x.median)]));
  };
  const [medSeconds, medSessions] = [await medians("seconds"), await medians("sessionsBefore")];
  const buckets = async (sqlCase, column) => {
    const rows = await select(
      `WITH ${pl.sql} SELECT seg AS segment, ${sqlCase} AS bucket, COUNT(*) AS leads FROM pl WHERE ${column} IS NOT NULL GROUP BY seg, bucket`,
      pl.replacements,
    );
    const out = new Map();
    for (const x of rows) {
      if (!out.has(x.segment)) out.set(x.segment, {});
      out.get(x.segment)[x.bucket] = num(x.leads);
    }
    return out;
  };
  const [timeB, sessionB] = [await buckets(TIME_BUCKET_SQL, "seconds"), await buckets(SESSION_BUCKET_SQL, "sessionsBefore")];

  const build = (x) => {
    const complete = num(x.complete);
    const tb = timeB.get(x.segment) || {};
    const sb = sessionB.get(x.segment) || {};
    const round = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
    return {
      segment: x.segment,
      leads: num(x.leads),
      history: { complete, partial: num(x.partial), unknown: num(x.unknownHistory) },
      time: {
        averageSeconds: x.avgSeconds === null ? null : Math.round(Number(x.avgSeconds)),
        medianSeconds: medSeconds.has(x.segment) ? Math.round(medSeconds.get(x.segment)) : null,
        buckets: TIME_BUCKETS.map(([key, label]) => ({ key, label, leads: tb[key] || 0, share: pct(tb[key] || 0, complete) })),
      },
      sessions: {
        average: round(x.avgSessions === null ? null : Number(x.avgSessions)),
        median: medSessions.has(x.segment) ? round(medSessions.get(x.segment)) : null,
        buckets: SESSION_BUCKETS.map(([key, label]) => ({ key, label, leads: sb[key] || 0, share: pct(sb[key] || 0, complete) })),
        sameSession: num(x.sameSession),
        multiSession: num(x.multiSession),
        sameSessionRate: pct(num(x.sameSession), complete),
        multiSessionRate: pct(num(x.multiSession), complete),
      },
      journeys: { single: num(x.singleSource), multi: num(x.multiSource), unknown: num(x.leads) - num(x.singleSource) - num(x.multiSource) },
    };
  };
  const segments = summary.map(build).sort((a, b) => b.leads - a.leads);
  if (groupBy) return { model, modelLabel: MODELS[model].label, segment: null, overall: null, segments };
  let overall = segments.find((s) => s.segment === "all") || null;
  if (segment) {
    const all = await getTiming({ range, filters, model, segment: null });
    overall = all.overall;
  }
  return { model, modelLabel: MODELS[model].label, segment, overall: overall || build({ segment: "all" }), segments: segment ? segments : [] };
}

// ── trends ────────────────────────────────────────────────────────────────────

async function firstDataDay(tz) {
  const [row] = await select(`SELECT MIN(s.started_at) AS d FROM marketing_sessions s WHERE ${realSessions("s")}`, {});
  return row?.d ? localDateOf(new Date(row.d), tz) : null;
}

async function trendSeries({ range, filters, model, granularity, minDay, today }) {
  const { granularity: g, buckets } = trendBuckets(range, { granularity, minDay, today });
  if (!buckets.length) return { granularity: g, points: [] };
  const sb = bucketCase("s.started_at", buckets, "ts");
  const lb = bucketCase("l.submitted_at", buckets, "tl");
  const ob = bucketCase("m.paid_at", buckets, "to");
  const eb = bucketCase("e.timestamp", buckets, "te");
  const span = { start: buckets[0].start, end: buckets[buckets.length - 1].end };
  const sr = rangeSql(span, "s.started_at", "tsr_");
  const lr = rangeSql(span, "l.submitted_at", "tlr_");
  const er = rangeSql(span, "e.timestamp", "ter_");
  const orr = rangeSql(span, "m.paid_at", "tor_");
  const of = filterSql(filters, (d) => orderExpr(d, model), "tof");
  const sf = sessionFilters(filters, "s", "tsf");
  const lf = leadFilters(filters, model, "l", "tlf");
  const [sessions, leads, events, orders] = await Promise.all([
    select(
      `SELECT ${sb.sql} AS b, COUNT(*) AS sessions, COUNT(DISTINCT s.visitor_id) AS visitors,
              SUM(ls.session_id IS NOT NULL) AS leadSessions,
              COUNT(DISTINCT CASE WHEN ls.session_id IS NOT NULL THEN s.visitor_id END) AS leadVisitors
       FROM marketing_sessions s
       LEFT JOIN (SELECT DISTINCT session_id FROM lead_submissions WHERE test_mode = 0 AND session_id IS NOT NULL AND submitted_at >= :tsr_start) ls ON ls.session_id = s.session_id
       WHERE ${realSessions("s")} AND ${sr.sql}${sf.sql} GROUP BY b`,
      { ...sb.replacements, ...sr.replacements, ...sf.replacements },
    ),
    select(
      `SELECT ${lb.sql} AS b, COUNT(*) AS leads,
              SUM(l.conversion_status IN ('qualified', 'won')) AS qualifiedLeads,
              SUM(l.conversion_status = 'won') AS wonLeads,
              SUM(CASE WHEN l.conversion_status = 'won' THEN COALESCE(l.revenue, 0) ELSE 0 END) AS leadRevenue
       FROM lead_submissions l WHERE l.test_mode = 0 AND ${lr.sql}${lf.sql} GROUP BY b`,
      { ...lb.replacements, ...lr.replacements, ...lf.replacements },
    ),
    select(
      `SELECT ${eb.sql} AS b,
              COUNT(DISTINCT CASE WHEN e.event_type = 'form_start' THEN e.session_id END) AS formStartSessions,
              COUNT(DISTINCT CASE WHEN e.event_type = 'form_submit' THEN e.session_id END) AS formSubmitSessions,
              COUNT(DISTINCT CASE WHEN e.event_type IN ${CTA_TYPE_SQL} THEN e.session_id END) AS ctaSessions
       FROM marketing_analytics_events e
       ${sf.any ? "JOIN marketing_sessions s ON s.session_id = e.session_id" : ""}
       WHERE e.event_type IN ('form_start', 'form_submit', ${CTA_TYPE_SQL.slice(1, -1)}) AND ${realEvents("e")} AND ${er.sql}${sf.sql}
       GROUP BY b`,
      { ...eb.replacements, ...er.replacements, ...sf.replacements },
    ),
    // Order revenue: paid orders by payment day, the order's own attribution (never added to leads).
    select(
      `SELECT ${ob.sql} AS b, COUNT(*) AS orders, SUM(m.revenue) AS orderRevenue
       FROM marketing_order_attribution m WHERE m.status = 'paid' AND ${orr.sql}${of.sql} GROUP BY b`,
      { ...ob.replacements, ...orr.replacements, ...of.replacements },
    ),
  ]);
  const by = (rows) => new Map(rows.filter((x) => x.b !== null).map((x) => [Number(x.b), x]));
  const S = by(sessions);
  const L = by(leads);
  const E = by(events);
  const O = by(orders);
  const money = (v) => Math.round(num(v) * 100) / 100;
  const points = buckets.map((b, i) => {
    const s = S.get(i) || {};
    const e = E.get(i) || {};
    const l = L.get(i) || {};
    const o = O.get(i) || {};
    const visitors = num(s.visitors);
    const sess = num(s.sessions);
    return {
      key: b.key,
      label: b.label,
      from: b.from,
      to: b.to,
      visitors,
      sessions: sess,
      leads: num(l.leads),
      qualifiedLeads: num(l.qualifiedLeads),
      wonLeads: num(l.wonLeads),
      leadRevenue: money(l.leadRevenue),
      orders: num(o.orders),
      orderRevenue: money(o.orderRevenue),
      visitorToLeadRate: pct(num(s.leadVisitors), visitors),
      sessionToLeadRate: pct(num(s.leadSessions), sess),
      formStartSessions: num(e.formStartSessions),
      formSubmitSessions: num(e.formSubmitSessions),
      ctaSessions: num(e.ctaSessions),
    };
  });
  return { granularity: g, points };
}

/**
 * Trend series; with a comparison range the previous period is returned only when it has the
 * same number of buckets (otherwise the lines would not be comparable → compareNote).
 */
async function getTrends({ range, compareRange = null, filters = {}, model = "operational", granularity = null }) {
  const tz = range.tz;
  const today = localDateOf(new Date(), tz);
  const minDay = range.fromDay ? null : await firstDataDay(tz);
  const current = await trendSeries({ range, filters, model, granularity, minDay, today });
  let previous = null;
  let compareNote = null;
  if (compareRange) {
    const prev = await trendSeries({ range: compareRange, filters, model, granularity: current.granularity, today });
    if (prev.points.length === current.points.length) previous = prev.points;
    else compareNote = `The previous period has ${prev.points.length} ${current.granularity} buckets and this one ${current.points.length}; lines are not overlaid.`;
  }
  return { model, modelLabel: MODELS[model].label, granularity: current.granularity, points: current.points, previous, compareNote };
}

module.exports = {
  getForms,
  getCtas,
  getFunnel,
  getTiming,
  getTrends,
  TIME_BUCKETS,
  SESSION_BUCKETS,
};
