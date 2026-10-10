/**
 * Reporting reconciliation on a controlled dataset (local DB only; every row it writes is
 * removed). Seeds 2019-06-02 (a day with no other data) and checks:
 *   - real leads in the lead table = Σ leads by source = Σ leads by source+medium
 *     = Σ leads by campaign ("(not set)" bucket included), even for a source / campaign that has
 *     leads but no tracked visitors, and with more than 50 visitor sources (old top-50 cap);
 *   - test / preview leads excluded;
 *   - Campaign Builder preview / canvas traffic excluded from visitors, funnel, recent events,
 *     product and store analytics;
 *   - new vs returning visitors: 1 session with several page views → new; 2 sessions → returning.
 *   npm run marketing:reporting-test
 */
require("dotenv").config();
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getAnalyticsEventModel } = require("../models/analyticsEvent");
const { getSessionModel } = require("../models/session");
const { getVisitorModel } = require("../models/visitor");
const { getTouchpointModel } = require("../models/touchpoint");
const { getLeadSubmissionModel } = require("../models/leadSubmission");
const dashboard = require("../services/analyticsDashboard.service");
const products = require("../services/productAnalytics.service");
const { parseReportRange } = require("../utils/businessTime");

const RUN = `rpt-${Date.now()}`;
const FROM = "2019-06-01";
const TO = "2019-06-03";
const T = (min = 0) => new Date(Date.UTC(2019, 5, 2, 16, min));
let failures = 0;
function check(ok, label) {
  if (!ok) failures += 1;
  // eslint-disable-next-line no-console
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
}
const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
let seq = 0;
const id = (p) => `${RUN}-${p}-${(seq += 1)}`;

async function seed() {
  const Visitor = getVisitorModel();
  const Session = getSessionModel();
  const Event = getAnalyticsEventModel();
  const Touchpoint = getTouchpointModel();
  const Lead = getLeadSubmissionModel();

  async function visit(visitorId, { sessions, source, medium, campaign, pathname = "/", pageType = "site", views = 1, product }) {
    await Visitor.findOrCreate({ where: { visitorId }, defaults: { visitorId, firstSeenAt: T(0), lastSeenAt: T(50) } });
    for (const [i, sessionId] of sessions.entries()) {
      const start = T(i * 45);
      await Session.create({ sessionId, visitorId, startedAt: start, endedAt: T(i * 45 + 5), entryPathname: pathname, pageCount: views });
      await Touchpoint.create({
        id: id("tp"), visitorId, sessionId, timestamp: start, source: i === 0 ? source : "direct", medium: i === 0 ? medium : "none",
        campaign: i === 0 ? campaign || "" : "", pathname, channel: i === 0 ? "Other" : "Direct",
      });
      for (let v = 0; v < views; v += 1) {
        await Event.create({
          id: id("ev"), visitorId, sessionId, eventType: pageType === "landing_page" ? "landing_page_view" : "page_view",
          timestamp: T(i * 45 + v), pathname, pageType, pageSlug: pathname.replace(/^\/+/, "").replace(/\//g, "-") || "home",
          landingPageSlug: pageType === "landing_page" ? pathname.split("/")[2] : null, site: "customer-website",
          productId: product || null, attribution: { source, medium, campaign }, metadata: {},
        });
      }
    }
  }

  // Real traffic.
  await visit(`${RUN}-v1`, { sessions: [`${RUN}-s1`], source: "google", medium: "cpc", campaign: "brand", pathname: `/lp/${RUN}-page`, pageType: "landing_page", views: 3 });
  await visit(`${RUN}-v2`, { sessions: [`${RUN}-s2a`, `${RUN}-s2b`], source: "facebook", medium: "paid_social", campaign: "fb1" });
  await visit(`${RUN}-v5`, { sessions: [`${RUN}-s5`], source: "google", medium: "organic", pathname: "/products/x", product: `${RUN}-real-product` });
  for (let i = 0; i < 55; i += 1) {
    await visit(`${RUN}-f${i}`, { sessions: [`${RUN}-fs${i}`], source: `${RUN}-filler-${i}`, medium: "referral" });
  }

  // Campaign Builder preview / canvas traffic (must be invisible in reports).
  await Event.create({
    id: id("ev"), visitorId: `${RUN}-p1`, sessionId: `${RUN}-ps1`, eventType: "landing_page_view", timestamp: T(3),
    pathname: "/preview/landing-page/abc", pageType: "preview", site: "campaign-preview", metadata: {}, attribution: {},
  });
  await Event.create({
    id: id("ev"), visitorId: `${RUN}-p1`, sessionId: `${RUN}-ps1`, eventType: "page_view", timestamp: T(4),
    pathname: "/preview/landing-page/abc", pageType: "preview", site: "campaign-preview", productId: `${RUN}-preview-product`, metadata: {}, attribution: {},
  });
  await Event.create({
    id: id("ev"), visitorId: `${RUN}-p1`, sessionId: `${RUN}-ps1`, eventType: "add_to_cart", timestamp: T(5),
    pathname: "/preview/landing-page/abc", pageType: "preview", site: "campaign-preview", productId: `${RUN}-preview-product`, metadata: {}, attribution: {},
  });
  // Legacy preview session (created before preview traffic was classified at ingest).
  await Visitor.create({ visitorId: `${RUN}-p2`, firstSeenAt: T(0), lastSeenAt: T(9) });
  await Session.create({ sessionId: `${RUN}-ps2`, visitorId: `${RUN}-p2`, startedAt: T(1), endedAt: T(9), entryPathname: "/admin/builder/lp-1" });
  await Touchpoint.create({ id: id("tp"), visitorId: `${RUN}-p2`, sessionId: `${RUN}-ps2`, timestamp: T(1), source: "preview-src", pathname: "/admin/builder/lp-1" });

  // Leads: 5 real (one with no campaign, one from a source with no visitors), 2 test / preview.
  const lead = (extra) => Lead.create({
    pageUrl: "https://example.test/contact", fields: { name: "Report test" }, submittedAt: T(20), testMode: false,
    conversionStatus: "new", submitStatus: "success", attribution: {}, device: {}, ...extra,
  });
  await lead({ visitorId: `${RUN}-v1`, sessionId: `${RUN}-s1`, channel: "Paid Search", source: "google", medium: "cpc", campaign: "brand" });
  await lead({ visitorId: `${RUN}-v1`, sessionId: `${RUN}-s1`, channel: "Paid Search", source: "google", medium: "cpc", campaign: "brand" });
  await lead({ visitorId: `${RUN}-v2`, sessionId: `${RUN}-s2b`, channel: "Paid Social", source: "facebook", medium: "paid_social", campaign: "fb1" });
  await lead({ visitorId: `${RUN}-nov`, channel: "Email", source: "newsletter", medium: "email", campaign: null });
  await lead({ visitorId: `${RUN}-tiny`, channel: "Referral", source: `${RUN}-tiny-source`, medium: "referral", campaign: `${RUN}-tiny-campaign` });
  await lead({ visitorId: `${RUN}-t1`, testMode: true, channel: "Paid Search", source: "google", medium: "cpc", campaign: "brand" });
  await lead({ visitorId: `${RUN}-t2`, testMode: true, source: "preview", attribution: { testReason: "preview_token" } });
}

async function checks() {
  const db = getMarketingSequelize();
  const d = await dashboard.getDashboard({ from: FROM, to: TO });
  const [{ n: realLeads }] = await db.query(
    "SELECT COUNT(*) AS n FROM lead_submissions WHERE test_mode = 0 AND submitted_at >= :a AND submitted_at < :b",
    { replacements: { a: "2019-06-01", b: "2019-06-05" }, type: QueryTypes.SELECT },
  );
  const leadsBySource = sum(d.marketing.trafficSources, "leads");
  const leadsBySourceMedium = sum(d.marketing.trafficSourceMediums, "leads");
  const leadsByCampaign = sum(d.marketing.utmCampaigns, "leads");
  check(Number(realLeads) === 5 && d.executive.totalLeads === 5, `lead table real leads = dashboard total = 5 (got ${realLeads} / ${d.executive.totalLeads})`);
  check(leadsBySource === 5, `Σ leads by source = 5 (got ${leadsBySource})`);
  check(leadsBySourceMedium === 5, `Σ leads by source+medium = 5 (got ${leadsBySourceMedium})`);
  check(leadsByCampaign === 5, `Σ leads by campaign = 5, "(not set)" included (got ${leadsByCampaign})`);
  const tiny = d.marketing.trafficSources.find((r) => r.source === `${RUN}-tiny-source`);
  check(Boolean(tiny) && tiny.leads === 1 && tiny.visitors === 0, "source with leads but no visitors is not dropped (58 visitor sources > old top-50)");
  const tinyCampaign = d.marketing.utmCampaigns.find((r) => r.campaign === `${RUN}-tiny-campaign`);
  check(Boolean(tinyCampaign) && tinyCampaign.leads === 1, "campaign with leads but no visitors is not dropped");
  check(d.marketing.utmCampaigns.find((r) => r.campaign === "(not set)")?.leads === 1, 'lead without campaign counted in "(not set)"');
  check(d.marketing.trafficSources.find((r) => r.source === "google")?.leads === 2, "google leads = 2 (test lead excluded)");

  // Visitors: v1 (1 session, 3 views), v2 (2 sessions), v5 (1), 55 fillers → 58; preview excluded.
  check(d.executive.totalVisitors === 58, `visitors = 58, preview excluded (got ${d.executive.totalVisitors})`);
  check(d.executive.returningVisitors === 1 && d.executive.newVisitors === 57, `returning = 1 (2 sessions), new = 57 (1 session, several views) (got ${d.executive.returningVisitors} / ${d.executive.newVisitors})`);
  check(!d.marketing.trafficSources.some((r) => r.source === "preview-src"), "legacy preview touchpoint excluded from traffic sources");
  const lpViews = d.funnel.find((s) => s.step === "landing_page_view")?.count;
  check(lpViews === 3, `funnel landing page views = 3, preview views excluded (got ${lpViews})`);
  check(d.executive.addToCarts === 0, `add-to-cart count excludes preview (got ${d.executive.addToCarts})`);
  check(!d.recentEvents.some((e) => e.pageType === "preview"), "recent events exclude preview");
  check(!d.recentTouchpoints.some((t) => String(t.pathname).startsWith("/admin")), "recent touchpoints exclude preview");

  const range = parseReportRange(FROM, TO);
  const report = await products.getProductReport(range, { lookupProducts: async () => new Map() });
  const ids = report.rows.map((r) => String(r.productId));
  check(ids.includes(`${RUN}-real-product`) && !ids.includes(`${RUN}-preview-product`), "product analytics exclude preview product views");
  const store = await products.getStoreFunnel(range, null, { lookupCustomers: async () => new Map() });
  const step = (name) => (store.funnel || []).find((s) => s.step === name);
  check(step("product_view")?.anyOrder === 1, `store funnel product views = 1 real session, preview excluded (got ${step("product_view")?.anyOrder})`);
  check(step("add_to_cart")?.anyOrder === 0 && step("add_to_cart")?.sessions === 0, "store funnel excludes preview add-to-cart");
}

async function cleanup() {
  const db = getMarketingSequelize();
  const like = `${RUN}%`;
  for (const sql of [
    "DELETE FROM marketing_analytics_events WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_touchpoints WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_sessions WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_visitors WHERE visitor_id LIKE :like",
    "DELETE FROM lead_submissions WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_daily_page_stats WHERE stat_date BETWEEN '2019-05-30' AND '2019-06-05'",
    "DELETE FROM marketing_daily_rollup_runs WHERE stat_date BETWEEN '2019-05-30' AND '2019-06-05'",
  ]) {
    // eslint-disable-next-line no-await-in-loop
    await db.query(sql, { replacements: { like } });
  }
}

async function run() {
  try {
    await seed();
    await checks();
  } finally {
    await cleanup();
  }
  // eslint-disable-next-line no-console
  console.log(failures ? `[reporting-test] ${failures} failed` : "[reporting-test] passed");
  if (failures) throw new Error(`${failures} reporting checks failed`);
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[reporting-test] failed:", error.message);
      process.exit(1);
    });
}

module.exports = { run };
