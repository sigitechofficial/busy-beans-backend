/**
 * Reporting Phase A checks: presets / comparison periods, attribution-model switching on a real
 * journey (Google Ads → Direct → LinkedIn → Direct conversion), acquisition drill-down
 * reconciliation, explicit unknown buckets, test / preview exclusion, overview comparison,
 * lead list filters / sorting / pagination, CSV export (+ contact-column permission) and the
 * HTTP endpoints. Local DB only; seeds 2019-07-10 (+ 2019-07-09 for the previous period) and
 * removes every row it writes.
 *   npm run marketing:reports-test
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getMarketingJwtSecret } = require("../services/auth.service");
const { getSessionModel } = require("../models/session");
const { getVisitorModel } = require("../models/visitor");
const { getLeadSubmissionModel } = require("../models/leadSubmission");
const touchpoints = require("../services/touchpoints.service");
const leads = require("../services/leadSubmissions.service");
const reports = require("../services/reports.service");
const { rangeFromQuery, compareRangeFromQuery, csvCell, MODELS } = require("../utils/reportQuery");

const BASE = (process.env.MARKETING_TEST_BASE_URL || "http://localhost:8013").replace(/\/api\/?$/, "").replace(/\/+$/, "");
const RUN = `rpa-${Date.now()}`;
const SITE = "https://www.example-site.test";
const DAY = "2019-07-10";
const PREV_DAY = "2019-07-09"; // previous period of the single day DAY
const at = (day, min = 0) => new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 16, min));
let failures = 0;
function check(ok, label) {
  if (!ok) failures += 1;
  // eslint-disable-next-line no-console
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
}
const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
const db = () => getMarketingSequelize();
let seq = 0;
const id = (p) => `${RUN}-${p}-${(seq += 1)}`;

function unitChecks() {
  const now = new Date("2026-09-30T15:00:00Z"); // Wednesday, New York
  process.env.MARKETING_REPORT_TIMEZONE = process.env.MARKETING_REPORT_TIMEZONE || "America/New_York";
  const r = (q) => rangeFromQuery(q, { now });
  const days = (x) => `${x.fromDay}..${x.toDay}`;
  check(days(r({})) === "2026-09-01..2026-09-30", "default = last 30 days");
  check(days(r({ range: "today" })) === "2026-09-30..2026-09-30" && days(r({ range: "yesterday" })) === "2026-09-29..2026-09-29", "today / yesterday");
  check(days(r({ range: "last_7_days" })) === "2026-09-24..2026-09-30", "last 7 days");
  check(days(r({ range: "this_week" })) === "2026-09-28..2026-09-30" && days(r({ range: "last_week" })) === "2026-09-21..2026-09-27", "this / last week (Monday start)");
  check(days(r({ range: "this_month" })) === "2026-09-01..2026-09-30" && days(r({ range: "last_month" })) === "2026-08-01..2026-08-31", "this / last month");
  check(!r({ range: "all_time" }).start && days(r({ from: "2026-02-10", to: "2026-02-01" })) === "2026-02-01..2026-02-10", "all time; custom range with swapped dates");
  const cmp = (q) => days(compareRangeFromQuery({ compare: "previous" }, r(q)));
  check(cmp({ range: "last_7_days" }) === "2026-09-17..2026-09-23", "compare: previous 7 days");
  check(cmp({ range: "last_month" }) === "2026-07-01..2026-07-31", "compare: previous month (full month)");
  check(cmp({ range: "this_month" }) === "2026-08-01..2026-08-30", "compare: this month vs same days of previous month");
  check(compareRangeFromQuery({}, r({})) === null && compareRangeFromQuery({ compare: "1" }, r({ range: "all_time" })) === null, "no compare unless asked; none for all time");
  check(csvCell("=HYPERLINK(1)") === "'=HYPERLINK(1)" && csvCell('a,"b"') === '"a,""b"""', "CSV escaping + formula neutralisation");
}

async function seed() {
  const Visitor = getVisitorModel();
  const Session = getSessionModel();
  const Lead = getLeadSubmissionModel();
  const session = async (visitorId, sessionId, day, touch, entry = "/") => {
    await Visitor.findOrCreate({ where: { visitorId }, defaults: { visitorId, firstSeenAt: at(day), lastSeenAt: at(day, 30) } });
    await Session.create({ sessionId, visitorId, startedAt: at(day, seq % 50), endedAt: at(day, 55), entryPathname: entry, ...touch });
  };
  const lead = (extra) => Lead.create({
    pageUrl: `${SITE}/contact`, fields: { name: "Report A", email: `a+${seq}@example.test`, company: "=cmd" }, submittedAt: at(DAY, 20),
    testMode: false, conversionStatus: "new", submitStatus: "success", attribution: {}, device: {}, ...extra,
  });
  const T = (channel, source, medium, campaign) => ({ channel, source, medium, campaign });

  // Sessions (acquisition): Paid Search ×3 (2 visitors), Paid Social ×1, Direct ×1, unknown ×1,
  // one preview session (excluded), one session in the previous period.
  await session(`${RUN}-va`, `${RUN}-sa1`, DAY, T("Paid Search", "google", "cpc", "brand"));
  await session(`${RUN}-va`, `${RUN}-sa2`, DAY, T("Paid Search", "google", "cpc", "brand"));
  await session(`${RUN}-vb`, `${RUN}-sb1`, DAY, T("Paid Search", "bing", "cpc", "brand"));
  await session(`${RUN}-vc`, `${RUN}-sc1`, DAY, T("Paid Social", "facebook", "paid_social", "fb1"));
  await session(`${RUN}-vd`, `${RUN}-sd1`, DAY, T("Direct", "direct", "none", null));
  await session(`${RUN}-ve`, `${RUN}-se1`, DAY, {});
  await session(`${RUN}-vp`, `${RUN}-sp1`, DAY, T("Paid Search", "google", "cpc", "brand"), "/admin/builder/x");
  await session(`${RUN}-vq`, `${RUN}-sq1`, PREV_DAY, T("Paid Search", "google", "cpc", "brand"));

  // Leads: 12 real (varied statuses, forms, revenue), 1 test.
  const L = (visitorId, sessionId, t, extra = {}) => lead({ visitorId, sessionId, ...t, lndChannel: t.channel, lndSource: t.source, ...extra });
  await L(`${RUN}-va`, `${RUN}-sa2`, T("Paid Search", "google", "cpc", "brand"), { conversionStatus: "won", revenue: 1000, formId: "hero", firstTouchSource: "google" });
  await L(`${RUN}-vb`, `${RUN}-sb1`, T("Paid Search", "bing", "cpc", "brand"), { conversionStatus: "qualified", formId: "footer" });
  await L(`${RUN}-vc`, `${RUN}-sc1`, T("Paid Social", "facebook", "paid_social", "fb1"), { conversionStatus: "won", revenue: 250, formId: "hero" });
  for (let i = 0; i < 8; i += 1) {
    await L(`${RUN}-x${i}`, null, T("Organic Search", "google", "organic", null), { formId: "contact", revenue: i === 0 ? 5 : null });
  }
  await lead({ visitorId: `${RUN}-u1`, formId: "contact" }); // no attribution at all → Unknown / (not set)
  await lead({ visitorId: `${RUN}-t1`, testMode: true, ...T("Paid Search", "google", "cpc", "brand") });

  // Paid order in the period (order attribution: last touch = google).
  await db().query(
    `INSERT INTO marketing_order_attribution (order_id, visitor_id, session_id, first_touch, last_touch, status, paid_at, revenue)
     VALUES (:oid, :v, :s, :t, :t, 'paid', :paid, 400)`,
    { replacements: { oid: 900000000 + (Date.now() % 90000000), v: `${RUN}-va`, s: `${RUN}-sa1`, t: JSON.stringify({ source: "google", medium: "cpc", campaign: "brand", channel: "Paid Search" }), paid: at(DAY, 25) } },
  );
}

/** Google Ads → Direct → LinkedIn (organic) → Direct conversion, through the real ingest. */
async function journeyLead() {
  const v = `${RUN}-journey`;
  const tp = (s, url, referrer) =>
    touchpoints.ingestTouchpoint({ id: id("tp"), visitorId: v, sessionId: s, timestamp: new Date().toISOString(), pageUrl: url, pathname: new URL(url).pathname, touch: { landingUrl: url, referrer } });
  await tp(`${RUN}-j1`, `${SITE}/?gclid=GJ&utm_source=google&utm_medium=cpc&utm_campaign=jbrand`);
  await tp(`${RUN}-j2`, `${SITE}/`);
  await tp(`${RUN}-j3`, `${SITE}/`, "https://www.linkedin.com/feed/");
  await tp(`${RUN}-j4`, `${SITE}/`);
  const res = await leads.submitLead({ fields: { name: "Journey" }, pageUrl: `${SITE}/contact`, visitorId: v, sessionId: `${RUN}-j4`, formId: "hero" });
  const leadId = Number(String(res.id).replace("sub_", ""));
  await db().query("UPDATE lead_submissions SET submitted_at = :d WHERE id = :id", { replacements: { d: at(DAY, 30), id: leadId } });
  return leadId;
}

async function checks(journeyId) {
  const range = rangeFromQuery({ from: DAY, to: DAY });
  const [{ n: realLeads }] = await db().query(
    "SELECT COUNT(*) AS n FROM lead_submissions WHERE test_mode = 0 AND submitted_at >= :a AND submitted_at < :b",
    { replacements: { a: range.start, b: range.end }, type: QueryTypes.SELECT },
  );
  check(Number(realLeads) === 13, `seeded real leads in period = 13 (got ${realLeads})`);

  // Attribution model switching on the journey lead.
  const expected = {
    operational: ["Organic Social", "linkedin"],
    first: ["Paid Search", "google"],
    last: ["Direct", "direct"],
    last_non_direct: ["Organic Social", "linkedin"],
    session: ["Direct", "direct"],
    conversion: ["Direct", "direct"],
  };
  for (const model of Object.keys(MODELS)) {
    const channels = await reports.getAcquisition({ range, model, dimension: "channel" });
    const sources = await reports.getAcquisition({ range, model, dimension: "source" });
    const campaigns = await reports.getAcquisition({ range, model, dimension: "campaign" });
    const [ch, src] = expected[model];
    const jl = await reports.getAcquisition({ range, model, dimension: "source", filters: { channel: ch } });
    check(jl.rows.some((r) => r.value === src && r.leads >= 1), `model ${model}: journey lead credited to ${ch} / ${src}`);
    // Reconciliation: Σ by channel = Σ by source = Σ by campaign = lead table (for every model).
    const ok = sum(channels.rows, "leads") === 13 && sum(sources.rows, "leads") === 13 && sum(campaigns.rows, "leads") === 13 && channels.totals.leads === 13;
    check(ok, `model ${model}: Σ leads by channel = source = campaign = 13`);
    check(channels.rows.every((r) => r.visitorToLeadRate === null || r.visitorToLeadRate <= 100) && channels.rows.every((r) => r.sessionToLeadRate === null || r.sessionToLeadRate <= 100), `model ${model}: acquisition rates never exceed 100%`);
    check(Math.round(sum(channels.rows, "attributedLeadShare")) === 100, `model ${model}: attributed lead share sums to 100%`);
  }

  const op = await reports.getAcquisition({ range, model: "operational", dimension: "channel" });
  const row = (rows, v) => rows.find((r) => r.value === v) || {};
  const ps = row(op.rows, "Paid Search");
  check(ps.sessions === 3 && ps.visitors === 2 && ps.leadSessions === 2 && ps.sessionToLeadRate === 66.7 && ps.visitorToLeadRate === 100, `Paid Search acquisition: 3 sessions, 2 visitors, 2 converting sessions (66.7%), 100% visitors (got ${ps.sessions}/${ps.visitors}/${ps.sessionToLeadRate}/${ps.visitorToLeadRate})`);
  check(ps.leads === 2 && ps.wonLeads === 1 && ps.leadRevenue === 1000 && ps.orders === 1 && ps.orderRevenue === 400, "Paid Search: 2 leads, 1 won, lead revenue 1000 and order revenue 400 kept separate");
  check(row(op.rows, "Unknown").sessions === 1 && row(op.rows, "Unknown").leads === 1, "no attribution → explicit Unknown bucket (session and lead)");
  check(op.totals.sessions === 6 && op.totals.visitors === 5, `totals: preview + previous-period sessions excluded; 6 sessions, 5 distinct visitors (got ${op.totals.sessions}/${op.totals.visitors})`);
  const camp = await reports.getAcquisition({ range, model: "operational", dimension: "campaign" });
  check(row(camp.rows, "(not set)").leads >= 9, 'leads without campaign in "(not set)"');
  // Campaign with platform: one row per channel + source + medium + campaign, same totals.
  const detail = await reports.getAcquisition({ range, model: "operational", dimension: "campaignDetail" });
  check(
    detail.rows.every((r) => r.channel && r.source && r.medium && r.campaign === r.value) &&
      sum(detail.rows, "sessions") === sum(camp.rows, "sessions") && sum(detail.rows, "leads") === sum(camp.rows, "leads") &&
      JSON.stringify(detail.totals) === JSON.stringify(camp.totals) && detail.rows.length >= camp.rows.length,
    "campaignDetail: rows carry channel / source / medium and reconcile with the campaign grouping",
  );
  const detailPs = await reports.getAcquisition({ range, model: "operational", dimension: "campaignDetail", filters: { channel: "Paid Search" } });
  check(detailPs.rows.length > 0 && detailPs.rows.every((r) => r.channel === "Paid Search") && detailPs.totals.leads === ps.leads, "campaignDetail honours filters (Paid Search only)");

  // Drill-down: Paid Search → sources → medium; child totals = parent row.
  const psSources = await reports.getAcquisition({ range, model: "operational", dimension: "source", filters: { channel: "Paid Search" } });
  check(sum(psSources.rows, "leads") === ps.leads && sum(psSources.rows, "sessions") === ps.sessions, "drill: Σ sources within Paid Search = Paid Search row");
  const googleMedia = await reports.getAcquisition({ range, model: "operational", dimension: "medium", filters: { channel: "Paid Search", source: "google" } });
  check(googleMedia.rows.length === 1 && googleMedia.rows[0].value === "cpc" && googleMedia.rows[0].leads === 1, "drill: Paid Search → google → cpc");

  // Overview + previous period.
  const cmpRange = compareRangeFromQuery({ compare: "previous" }, range);
  const ov = await reports.getOverview({ range, compareRange: cmpRange, model: "operational" });
  const m = ov.metrics;
  check(m.leads.value === 13 && m.sessions.value === 6 && m.visitors.value === 5, `overview: leads 13, sessions 6, visitors 5 (got ${m.leads.value}/${m.sessions.value}/${m.visitors.value})`);
  check(m.wonLeads.value === 2 && m.leadRevenue.value === 1250 && m.orderRevenue.value === 400, "overview: won 2, lead revenue 1250, order revenue 400 (separate)");
  check(m.returningVisitors.value >= 1 && m.newVisitors.value + m.returningVisitors.value === m.visitors.value, "overview: new + returning = visitors");
  check(m.sessions.previous === 1 && m.sessions.delta === 5 && m.sessions.deltaPct === 500, `overview compare: previous 1 session, +5, +500% (got ${m.sessions.previous}/${m.sessions.delta}/${m.sessions.deltaPct})`);
  check(m.leads.previous === 0 && m.leads.deltaPct === null, "overview compare: previous 0 → percentage change N/A");

  // Lead list.
  const list = await reports.listLeads({ range, query: { pageSize: 10 } });
  check(list.total === 13 && list.rows.length === 10 && list.pages === 2, "lead list: total 13, page 1 of 2");
  const p2 = await reports.listLeads({ range, query: { pageSize: 10, page: 2 } });
  check(p2.rows.length === 3 && !p2.rows.some((r) => list.rows.some((x) => x.id === r.id)), "lead list: page 2 has the remaining 3, no overlap");
  const f = async (q) => (await reports.listLeads({ range, query: q })).total;
  check((await f({ channel: "Paid Search" })) === 2 && (await f({ status: "won" })) === 2 && (await f({ form: "contact" })) === 9, "lead list filters: channel, status, form");
  check((await f({ firstSource: "google" })) >= 2 && (await f({ lndSource: "linkedin" })) === 1 && (await f({ lastSource: "direct" })) >= 1, "lead list filters: first / last / last non-direct source");
  check((await f({ test: "test" })) === 1 && (await f({ test: "all" })) === 14, "lead list: test filter (real by default)");
  check((await f({ q: `sub_${journeyId}` })) === 1, "lead list: search by lead id");
  const byRevenue = await reports.listLeads({ range, query: { sort: "revenue", dir: "desc", pageSize: 10 } });
  check(Number(byRevenue.rows[0].revenue) === 1000, "lead list: sort by revenue");

  // CSV export.
  const noContact = await reports.exportLeads({ range, query: {}, access: { canViewCustomerDetails: false } });
  const headers = noContact.columns.map((c) => c.header);
  check(noContact.rows.length === 13 && !headers.includes("email") && headers.includes("last_non_direct_source") && headers.includes("twclid"), "lead CSV: 13 rows, attribution + all click IDs, no contact columns without permission");
  const withContact = await reports.exportLeads({ range, query: {}, access: { canViewCustomerDetails: true } });
  check(withContact.columns.some((c) => c.header === "email"), "lead CSV: contact columns only with customer-details permission");
}

async function httpChecks() {
  let up = false;
  try {
    up = (await fetch(`${BASE}/api/public/tracking/settings`)).status < 500;
  } catch {
    up = false;
  }
  if (!up) {
    // eslint-disable-next-line no-console
    console.log(`skip HTTP checks (API not reachable at ${BASE})`);
    return;
  }
  const token = jwt.sign({ sub: "0", scope: "marketing", role: "Viewer" }, getMarketingJwtSecret(), { expiresIn: "5m" });
  const auth = { Authorization: `Bearer ${token}` };
  const q = `from=${DAY}&to=${DAY}`;
  check((await fetch(`${BASE}/api/admin/analytics/reports/overview?${q}`)).status === 401, "reports require a Campaign Builder login");
  const ov = await fetch(`${BASE}/api/admin/analytics/reports/overview?${q}&compare=previous`, { headers: auth });
  const ovBody = await ov.json();
  check(ov.status === 200 && ovBody.data.metrics.leads.value === 13 && ovBody.data.period.compare.from === "2019-07-09", "GET /reports/overview (with previous period)");
  const acq = await fetch(`${BASE}/api/admin/analytics/reports/acquisition?${q}&dimension=source&channel=Paid%20Search&attribution=first`, { headers: auth });
  const acqBody = await acq.json();
  check(acq.status === 200 && acqBody.data.model === "first" && acqBody.data.dimension === "source", "GET /reports/acquisition (drill + model)");
  const csv = await fetch(`${BASE}/api/admin/analytics/reports/acquisition?${q}&dimension=channel&format=csv`, { headers: auth });
  const csvText = await csv.text();
  check(csv.status === 200 && /text\/csv/.test(csv.headers.get("content-type")) && csvText.includes("Paid Search") && csvText.includes("Total"), "acquisition CSV (same aggregation as the table)");
  // The Campaign Builder downloads from another origin: it must be able to read the filename / truncation flag.
  const cross = await fetch(`${BASE}/api/admin/analytics/reports/acquisition?${q}&dimension=channel&format=csv`, { headers: { ...auth, Origin: "http://localhost:3000" } });
  const exposed = String(cross.headers.get("access-control-expose-headers") || "").toLowerCase();
  check(exposed.includes("content-disposition") && exposed.includes("x-export-truncated") && /attachment; filename="channel-/.test(cross.headers.get("content-disposition") || ""), "CSV filename + truncation flag readable cross-origin (CORS expose headers)");
  const det = await (await fetch(`${BASE}/api/admin/analytics/reports/acquisition?${q}&dimension=campaignDetail&channel=Paid%20Search`, { headers: auth })).json();
  check(det.data?.dimension === "campaignDetail" && det.data.rows.length > 0 && det.data.rows.every((r) => r.channel === "Paid Search" && r.source), "GET /reports/acquisition?dimension=campaignDetail (filtered, with platform)");
  const detCsv = await (await fetch(`${BASE}/api/admin/analytics/reports/acquisition?${q}&dimension=campaignDetail&format=csv`, { headers: auth })).text();
  check(/^"?channel"?,"?source"?,"?medium"?,"?campaign"?,/.test(detCsv), "campaignDetail CSV has channel, source, medium, campaign columns");
  // A filter on the grouped field itself applies (filter bar: Source = google, grouped by source).
  const own = await (await fetch(`${BASE}/api/admin/analytics/reports/acquisition?${q}&dimension=channel&channel=Paid%20Search`, { headers: auth })).json();
  check(own.data.rows.length === 1 && own.data.rows[0].value === "Paid Search", "filter on the grouped field narrows the rows");
  const bad = await fetch(`${BASE}/api/admin/analytics/reports/acquisition?${q}&dimension=password`, { headers: auth });
  check(bad.status === 400, "unknown dimension → 400");
  const leadCsv = await fetch(`${BASE}/api/admin/analytics/reports/leads/export?${q}&channel=Paid%20Search`, { headers: auth });
  const leadCsvText = await leadCsv.text();
  check(leadCsv.status === 200 && leadCsvText.split("\r\n").length === 3 && !leadCsvText.includes("email"), "lead CSV over HTTP: filtered, no contact columns for a non-PII role");
  const page = await fetch(`${BASE}/api/admin/analytics/reports/leads?${q}&pageSize=10&page=2`, { headers: auth });
  const pageBody = await page.json();
  check(page.status === 200 && pageBody.data.total === 13 && pageBody.data.rows.length === 3, "GET /reports/leads pagination");
}

async function cleanup() {
  const like = `${RUN}%`;
  for (const sql of [
    "DELETE FROM marketing_analytics_events WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_touchpoints WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_sessions WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_visitors WHERE visitor_id LIKE :like",
    "DELETE FROM lead_submissions WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_order_attribution WHERE visitor_id LIKE :like",
  ]) {
    // eslint-disable-next-line no-await-in-loop
    await db().query(sql, { replacements: { like } });
  }
}

async function run() {
  unitChecks();
  try {
    await seed();
    const journeyId = await journeyLead();
    await checks(journeyId);
    await httpChecks();
  } finally {
    await cleanup();
  }
  // eslint-disable-next-line no-console
  console.log(failures ? `[reports-test] ${failures} failed` : "[reports-test] passed");
  if (failures) throw new Error(`${failures} reports checks failed`);
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[reports-test] failed:", error.message);
      process.exit(1);
    });
}

module.exports = { run };
