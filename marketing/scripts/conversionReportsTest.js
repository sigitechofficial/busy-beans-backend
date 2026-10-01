/**
 * Reporting Phase B checks on a controlled fixture (local DB only; every row is removed):
 * form metrics + rates, CTA unique-session metrics + CTA → lead (+ later-visit assists), the
 * strictly ordered funnel (+ segmentation), time to conversion / sessions before conversion
 * (median, average, buckets, same vs multi-session, single vs multi-source), unknown / partial
 * legacy history, test + preview exclusion, date filtering, timezone bucketing, trends, CSV and
 * permissions. Window: 2019-08-10 … 2019-08-20 (New York business days).
 *   npm run marketing:conversion-test            (add -- --keep to leave the fixture for a manual look,
 *                                                 then -- --cleanup=<run id> to remove it)
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getMarketingJwtSecret } = require("../services/auth.service");
const { getSessionModel } = require("../models/session");
const { getVisitorModel } = require("../models/visitor");
const { getAnalyticsEventModel } = require("../models/analyticsEvent");
const { getLeadSubmissionModel } = require("../models/leadSubmission");
const conv = require("../services/conversionReports.service");
const { rangeFromQuery } = require("../utils/reportQuery");

const BASE = (process.env.MARKETING_TEST_BASE_URL || "http://localhost:8013").replace(/\/api\/?$/, "").replace(/\/+$/, "");
// --cleanup=<run id> removes a fixture kept with --keep (used for manual browser checks).
const CLEANUP = (process.argv.find((a) => a.startsWith("--cleanup=")) || "").slice("--cleanup=".length);
const RUN = CLEANUP || `rpb-${Date.now()}`;
const LP = `${RUN}-lp`;
const FROM = "2019-08-10";
const TO = "2019-08-20";
const T = (day, hour, min = 0) => new Date(Date.UTC(2019, 7, day, hour, min)); // August 2019, UTC
let failures = 0;
function check(ok, label) {
  if (!ok) failures += 1;
  // eslint-disable-next-line no-console
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
}
const db = () => getMarketingSequelize();
let seq = 0;

async function seed() {
  const Visitor = getVisitorModel();
  const Session = getSessionModel();
  const Event = getAnalyticsEventModel();
  const Lead = getLeadSubmissionModel();
  const touch = (source, channel, at) => ({ source, channel, medium: channel === "Direct" ? "none" : "cpc", receivedAt: at.toISOString() });
  const visitor = (id, firstTouch) =>
    Visitor.create({ visitorId: `${RUN}-${id}`, firstSeenAt: T(10, 12), lastSeenAt: T(20, 12), firstTouch: firstTouch || null });
  const session = (vid, sid, start, t, entry = `/lp/${LP}`) =>
    Session.create({
      sessionId: `${RUN}-${sid}`, visitorId: `${RUN}-${vid}`, startedAt: start, endedAt: new Date(start.getTime() + 20 * 60000),
      entryPathname: entry, entryLandingPageSlug: entry.startsWith("/lp/") ? LP : null, ...t,
    });
  const ev = (vid, sid, type, at, meta = {}, page = { pageType: "landing_page", pageSlug: LP, pathname: `/lp/${LP}` }) =>
    Event.create({
      id: `${RUN}-ev-${(seq += 1)}`, visitorId: `${RUN}-${vid}`, sessionId: `${RUN}-${sid}`, eventType: type, timestamp: at,
      pathname: page.pathname, pageType: page.pageType, pageSlug: page.pageSlug, landingPageSlug: page.pageType === "landing_page" ? LP : null,
      site: page.pageType === "preview" ? "campaign-preview" : "customer-website", metadata: meta, attribution: {},
    });
  const lead = (vid, sid, at, extra = {}) =>
    Lead.create({
      pageUrl: `https://www.example.test/lp/${LP}`, fields: { name: "B" }, submittedAt: at, testMode: false, conversionStatus: "new",
      submitStatus: "success", attribution: {}, device: {}, visitorId: vid ? `${RUN}-${vid}` : null, sessionId: sid ? `${RUN}-${sid}` : null,
      pageType: "landing_page", pageSlug: LP, landingPageSlug: LP, ...extra,
    });
  const PS = { channel: "Paid Search", source: "google", medium: "cpc" };
  const SOC = { channel: "Paid Social", source: "facebook", medium: "paid_social" };
  const ORG = { channel: "Organic Search", source: "google", medium: "organic" };
  const DIR = { channel: "Direct", source: "direct", medium: "none" };

  // V1 · S1 (Paid Search): LP view → CTA ×2 → form view/start/submit (hero) → lead L1. Same session.
  await visitor("v1", touch("google", "Paid Search", T(12, 14)));
  await session("v1", "s1", T(12, 14), PS);
  await ev("v1", "s1", "landing_page_view", T(12, 14, 1));
  await ev("v1", "s1", "cta_click", T(12, 14, 2), { cta_name: "hero_request_quote", cta_location: "hero" });
  await ev("v1", "s1", "cta_click", T(12, 14, 3), { cta_name: "hero_request_quote", cta_location: "hero" });
  await ev("v1", "s1", "form_view", T(12, 14, 2), { form_id: "hero" });
  await ev("v1", "s1", "form_start", T(12, 14, 4), { form_id: "hero" });
  await ev("v1", "s1", "form_submit", T(12, 14, 6), { form_id: "hero" });
  await lead("v1", "s1", T(12, 14, 6), { formId: "hero", ...PS, firstTouchSource: "google", sessionTouch: { source: "google" } });
  // test lead in the same session: excluded everywhere
  await lead("v1", "s1", T(12, 14, 7), { formId: "hero", testMode: true, ...PS });

  // V2 · S2 (Paid Social): LP view → form start WITHOUT a CTA → submit → lead L2.
  await visitor("v2", touch("facebook", "Paid Social", T(13, 15)));
  await session("v2", "s2", T(13, 15), SOC);
  await ev("v2", "s2", "landing_page_view", T(13, 15, 1));
  await ev("v2", "s2", "form_start", T(13, 15, 2), { form_id: "hero" });
  await ev("v2", "s2", "form_submit", T(13, 15, 3), { form_id: "hero" });
  await lead("v2", "s2", T(13, 15, 3), { formId: "hero", ...SOC, firstTouchSource: "facebook", sessionTouch: { source: "facebook" } });

  // V3 · S3 (Paid Search): LP view → CTA ×3 → two forms started (footer + hero) → footer submit → lead creation failed.
  await visitor("v3", touch("google", "Paid Search", T(14, 16)));
  await session("v3", "s3", T(14, 16), PS);
  await ev("v3", "s3", "landing_page_view", T(14, 16, 1));
  for (let i = 0; i < 3; i += 1) await ev("v3", "s3", "cta_click", T(14, 16, 2 + i), { cta_name: "hero_request_quote", cta_location: "hero" });
  await ev("v3", "s3", "form_start", T(14, 16, 6), { form_id: "footer" });
  await ev("v3", "s3", "form_start", T(14, 16, 7), { form_id: "hero" });
  await ev("v3", "s3", "form_submit", T(14, 16, 8), { form_id: "footer" });

  // V4 · S4 (Organic): LP view → phone click (engagement, no lead).
  await visitor("v4", touch("google", "Organic Search", T(15, 17)));
  await session("v4", "s4", T(15, 17), ORG);
  await ev("v4", "s4", "landing_page_view", T(15, 17, 1));
  await ev("v4", "s4", "phone_click", T(15, 17, 2), { cta_name: "call_button", cta_location: "header" });

  // V5 · S5a (Paid Search) CTA, no lead → S5b two days later (Direct revisit) → lead L5 on the contact page.
  await visitor("v5", touch("google", "Paid Search", T(16, 13)));
  await session("v5", "s5a", T(16, 13), PS);
  await ev("v5", "s5a", "landing_page_view", T(16, 13, 1));
  await ev("v5", "s5a", "cta_click", T(16, 13, 2), { cta_name: "hero_request_quote", cta_location: "hero" });
  await session("v5", "s5b", T(18, 13), DIR, "/contact");
  await ev("v5", "s5b", "page_view", T(18, 13, 1), {}, { pageType: "site", pageSlug: "contact", pathname: "/contact" });
  await lead("v5", "s5b", T(18, 13, 5), { formId: "contact_page", pageType: "site", pageSlug: "contact", landingPageSlug: null, ...PS, firstTouchSource: "google", sessionTouch: { source: "direct" } });

  // V6 · S6a organic morning → S6b direct afternoon (same day, new session) → lead L6.
  await visitor("v6", touch("google", "Organic Search", T(17, 12)));
  await session("v6", "s6a", T(17, 12), ORG, "/");
  await session("v6", "s6b", T(17, 18), DIR, "/contact");
  await lead("v6", "s6b", T(17, 18, 10), { formId: "contact_page", pageType: "site", pageSlug: "contact", landingPageSlug: null, ...ORG, firstTouchSource: "google", sessionTouch: { source: "direct" } });

  // V7 legacy visitor (no first touch) with a recorded session → partial history; L8 without a session → unknown.
  await visitor("v7", null);
  await session("v7", "s7", T(19, 12), DIR, `/lp/${LP}`);
  await ev("v7", "s7", "landing_page_view", T(19, 12, 1));
  await lead("v7", "s7", T(19, 12, 30), { formId: "hero", ...DIR });
  await lead(null, null, T(19, 13), { formId: "hero" });

  // Preview traffic (excluded): preview events for the hero form.
  await session("v1", "sp", T(12, 20), PS, "/admin/builder/x");
  await ev("v1", "sp", "form_start", T(12, 20, 1), { form_id: "hero" }, { pageType: "preview", pageSlug: LP, pathname: "/preview/landing-page/x" });
  await ev("v1", "sp", "cta_click", T(12, 20, 2), { cta_name: "hero_request_quote", cta_location: "hero" }, { pageType: "preview", pageSlug: LP, pathname: "/preview/landing-page/x" });

  // Outside the window (date filtering): 2019-08-25.
  await visitor("v9", touch("google", "Paid Search", T(25, 12)));
  await session("v9", "s9", T(25, 12), PS);
  await ev("v9", "s9", "form_start", T(25, 12, 1), { form_id: "hero" });
  await lead("v9", "s9", T(25, 12, 2), { formId: "hero", ...PS });

  // Timezone: 2019-08-15 02:30 UTC = 2019-08-14 22:30 New York → belongs to the 14th.
  await visitor("vtz", touch("google", "Organic Search", T(15, 2, 30)));
  await session("vtz", "stz", T(15, 2, 30), ORG, "/");
}

async function checks() {
  const range = rangeFromQuery({ from: FROM, to: TO });
  const [{ n: realLeads }] = await db().query(
    "SELECT COUNT(*) AS n FROM lead_submissions WHERE test_mode = 0 AND submitted_at >= :a AND submitted_at < :b AND (visitor_id LIKE :v OR (visitor_id IS NULL AND page_slug = :lp))",
    { replacements: { v: `${RUN}-v%`, lp: LP, a: range.start, b: range.end }, type: QueryTypes.SELECT },
  );

  // ── forms ──
  const forms = await conv.getForms({ range, filters: {} });
  const row = (formKey, page) => forms.rows.find((r) => r.formKey === formKey && r.page === page) || {};
  const hero = row("hero", LP);
  check(hero.viewSessions === 1 && hero.startSessions === 3 && hero.submitSessions === 2 && hero.starts === 3, `hero: 1 view session, 3 start sessions, 2 submit sessions (got ${hero.viewSessions}/${hero.startSessions}/${hero.submitSessions})`);
  check(hero.leads === 4, `hero: 4 real leads (L1, L2, legacy L7, no-session L8; test + out-of-window excluded) (got ${hero.leads})`);
  check(hero.viewToStartRate === 100 && hero.startToSubmitRate === 66.7 && hero.startToLeadRate === 66.7 && hero.submitToLeadRate === 100, `hero rates: view→start 100, start→submit 66.7, start→lead 66.7, submit→lead 100 (got ${hero.viewToStartRate}/${hero.startToSubmitRate}/${hero.startToLeadRate}/${hero.submitToLeadRate})`);
  const footer = row("footer", LP);
  check(footer.startSessions === 1 && footer.submitSessions === 1 && footer.leads === 0 && footer.submitToLeadRate === 0, "footer: started + submitted, lead creation failed → 0% submit → lead");
  check(row("contact_page", "contact").leads === 2 && row("contact_page", "contact").startToLeadRate === null, "contact page: 2 leads, no form events → rates N/A (not invented)");
  check(forms.rows.every((r) => r.startSessions >= r.submitSessions || r.startSessions === 0) && forms.rows.every((r) => [r.viewToStartRate, r.startToSubmitRate, r.startToLeadRate, r.submitToLeadRate].every((x) => x === null || x <= 100)), "form rates never exceed 100%; starts ≥ submits");
  const formLeadSum = forms.rows.filter((r) => r.page === LP || r.page === "contact").reduce((s, r) => s + r.leads, 0);
  check(formLeadSum === Number(realLeads) && Number(realLeads) === 6, `Σ form leads = persisted real leads in the window = 6 (got ${formLeadSum} / ${realLeads})`);
  const heroByChannel = await conv.getForms({ range, filters: {}, segment: "channel", form: "hero", page: LP });
  const seg = (v) => heroByChannel.rows.find((r) => r.segment === v) || {};
  check(seg("Paid Search").startSessions === 2 && seg("Paid Search").leads === 1 && seg("Paid Social").leads === 1 && seg("Paid Social").startToLeadRate === 100, "hero form by channel: Paid Search 2 starts / 1 lead, Paid Social 1 lead (100%)");

  // ── CTAs ──
  const ctas = await conv.getCtas({ range, filters: {} });
  const hq = ctas.rows.find((r) => r.name === "hero_request_quote" && r.page === LP) || {};
  check(hq.clicks === 6 && hq.sessions === 3, `hero_request_quote: 6 clicks, 3 unique sessions (preview excluded) (got ${hq.clicks}/${hq.sessions})`);
  check(hq.leadSessions === 1 && hq.ctaToLeadRate === 33.3, `CTA → lead: 1 of 3 sessions = 33.3% (same session, after the click) (got ${hq.leadSessions}/${hq.ctaToLeadRate})`);
  check(hq.laterLeadSessions === 1, "CTA assist: 1 session whose visitor converted in a later visit (reported separately)");
  const phone = ctas.rows.find((r) => r.name === "call_button") || {};
  check(phone.kind === "Phone" && phone.clicks === 1 && phone.leadSessions === 0, "phone click reported as Phone engagement, not a lead");
  check(ctas.rows.every((r) => r.sessions <= r.clicks), "CTA sessions never exceed clicks");

  // ── funnel ──
  const funnel = await conv.getFunnel({ range, filters: {} });
  const s = funnel.overall.steps.map((x) => x.sessions);
  // Sessions in window: s1 s2 s3 s4 s5a s5b s6a s6b s7 stz = 10 (preview + out-of-window excluded)
  check(JSON.stringify(s) === JSON.stringify([10, 6, 4, 2, 2, 1]), `ordered funnel 10 → 6 LP views → 4 CTA → 2 form start → 2 submit → 1 lead (got ${JSON.stringify(s)})`);
  check(s.every((v, i) => i === 0 || v <= s[i - 1]), "funnel is monotonically decreasing");
  const byChannel = await conv.getFunnel({ range, filters: {}, segment: "channel" });
  const sumFirst = byChannel.segments.reduce((t, g) => t + g.steps[0].sessions, 0);
  const psF = byChannel.segments.find((g) => g.segment === "Paid Search");
  check(sumFirst === 10 && psF && JSON.stringify(psF.steps.map((x) => x.sessions)) === JSON.stringify([3, 3, 3, 2, 2, 1]), `segmented funnel: segments add up to 10; Paid Search 3 → 3 → 3 → 2 → 2 → 1 (got ${psF && JSON.stringify(psF.steps.map((x) => x.sessions))})`);
  const lpOnly = await conv.getFunnel({ range, filters: { landingPage: LP } });
  check(lpOnly.overall.steps[0].sessions === 6, `landing-page filter: 6 sessions entered on ${LP}`);

  // ── timing ──
  const timing = await conv.getTiming({ range, filters: {} });
  const o = timing.overall;
  check(o.leads === 6 && o.history.complete === 4 && o.history.partial === 1 && o.history.unknown === 1, `history: 4 complete, 1 partial legacy, 1 unknown (got ${JSON.stringify(o.history)})`);
  check(o.sessions.median === 1.5 && o.sessions.average === 1.5, `sessions before conversion: median 1.5, average 1.5 (got ${o.sessions.median}/${o.sessions.average})`);
  check(o.sessions.sameSession === 2 && o.sessions.sameSessionRate === 50 && o.sessions.multiSession === 2, "same-session 2 (50%), multi-session 2 — from session ids");
  // times: L1 6 min, L2 3 min (+0 skew), L5 2 days + 5 min, L6 6h10m → median = (6 min + 6h10m)/2
  const expectedMedian = Math.round((6 * 60 + (6 * 3600 + 10 * 60)) / 2);
  check(o.time.medianSeconds === expectedMedian, `median time to conversion = ${expectedMedian}s (got ${o.time.medianSeconds})`);
  const tb = Object.fromEntries(o.time.buckets.map((b) => [b.key, b.leads]));
  check(tb.same_session === 2 && tb.lt_1d === 1 && tb.d1_3 === 1 && tb.d4_7 === 0, `time buckets: same session 2, <1 day 1 (same day, new session), 1–3 days 1 (got ${JSON.stringify(tb)})`);
  check(o.journeys.single === 2 && o.journeys.multi === 2, `journeys: 2 single-source, 2 multi-source (got ${JSON.stringify(o.journeys)})`);
  const tByChannel = await conv.getTiming({ range, filters: {}, segment: "channel", model: "operational" });
  const tps = tByChannel.segments.find((g) => g.segment === "Paid Search");
  check(tps && tps.leads === 2 && tps.sessions.median === 1.5, `timing by channel (operational): Paid Search 2 leads, median 1.5 visits (got ${tps && tps.leads}/${tps && tps.sessions.median})`);

  // ── trends (timezone + reconciliation) ──
  const trends = await conv.getTrends({ range, filters: {} });
  const day14 = trends.points.find((p) => p.key === "2019-08-14");
  const day15 = trends.points.find((p) => p.key === "2019-08-15");
  check(trends.granularity === "day" && trends.points.length === 11, "trends: 11 daily points for an 11-day window");
  check(day14.sessions === 2 && day15.sessions === 1, `timezone: 02:30 UTC on the 15th counts on the 14th in New York (got 14th=${day14.sessions}, 15th=${day15.sessions})`);
  check(trends.points.reduce((t, p) => t + p.sessions, 0) === 10 && trends.points.reduce((t, p) => t + p.leads, 0) === 6, "trend totals reconcile with the funnel (10 sessions) and real leads (6)");
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
  const q = `from=${FROM}&to=${TO}`;
  for (const kind of ["forms", "ctas", "funnel", "timing", "trends"]) {
    // eslint-disable-next-line no-await-in-loop
    const unauth = await fetch(`${BASE}/api/admin/analytics/reports/${kind}?${q}`);
    check(unauth.status === 401, `${kind}: requires a Campaign Builder login`);
  }
  const csv = async (kind, extra = "") => {
    const r = await fetch(`${BASE}/api/admin/analytics/reports/${kind}?${q}&format=csv${extra}`, { headers: auth });
    return { status: r.status, type: r.headers.get("content-type"), text: await r.text() };
  };
  const f = await csv("forms");
  check(f.status === 200 && /text\/csv/.test(f.type) && f.text.includes("start_to_lead_rate_pct") && f.text.includes("hero"), "forms CSV");
  const c = await csv("ctas");
  check(c.status === 200 && c.text.includes("cta_to_lead_rate_pct") && c.text.includes("hero_request_quote"), "CTA CSV");
  const fu = await csv("funnel", "&segment=channel");
  check(fu.status === 200 && fu.text.includes("previous_step_rate_pct") && fu.text.includes("Paid Search"), "funnel CSV (segmented)");
  const t = await csv("timing");
  check(t.status === 200 && t.text.includes("Same session") && t.text.includes("partial legacy history"), "conversion-time CSV (buckets + excluded history)");
  const tr = await fetch(`${BASE}/api/admin/analytics/reports/trends?${q}&compare=previous`, { headers: auth });
  const trBody = await tr.json();
  check(tr.status === 200 && Array.isArray(trBody.data.previous) && trBody.data.previous.length === 11, "trends compare: previous period with the same number of buckets");
}

async function cleanup() {
  const like = `${RUN}%`;
  for (const sql of [
    "DELETE FROM marketing_analytics_events WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_sessions WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_visitors WHERE visitor_id LIKE :like",
    "DELETE FROM lead_submissions WHERE visitor_id LIKE :like OR page_slug = :lp",
  ]) {
    // eslint-disable-next-line no-await-in-loop
    await db().query(sql, { replacements: { like, lp: LP } });
  }
}

async function run() {
  if (CLEANUP) {
    await cleanup();
    // eslint-disable-next-line no-console
    console.log(`[conversion-test] fixture ${RUN} removed`);
    return;
  }
  const keep = process.argv.includes("--keep");
  try {
    await seed();
    await checks();
    await httpChecks();
  } finally {
    if (keep) {
      // eslint-disable-next-line no-console
      console.log(`[conversion-test] fixture kept (${FROM} … ${TO}); remove with --cleanup=${RUN}`);
    } else await cleanup();
  }
  // eslint-disable-next-line no-console
  console.log(failures ? `[conversion-test] ${failures} failed` : "[conversion-test] passed");
  if (failures) throw new Error(`${failures} conversion checks failed`);
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[conversion-test] failed:", error.message);
      process.exit(1);
    });
}

module.exports = { run };
