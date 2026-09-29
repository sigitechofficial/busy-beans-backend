/**
 * Reporting contract (Phase 9; won leads + repeat orders, Phase 13). Local DB only: builds a known scenario on a fixed past day
 * (2026-01-15, America/New_York), checks the rollup, range report, funnel and dashboard, then
 * removes every row it wrote and re-rolls that day.
 *   node marketing/scripts/pageStatsTest.js
 */
require("dotenv").config();
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const analyticsEventsService = require("../services/analyticsEvents.service");
const pageStats = require("../services/pageStats.service");
const analyticsDashboardService = require("../services/analyticsDashboard.service");
const { parseReportRange } = require("../utils/businessTime");

const TZ = "America/New_York";
const DAY = "2026-01-15"; // UTC-5: the day is 05:00Z Jan 15 → 05:00Z Jan 16

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function eq(actual, expected, label) {
  assert(actual === expected, `${label}: expected ${expected}, got ${actual}`);
}

async function run() {
  process.env.MARKETING_REPORT_TIMEZONE = TZ;
  const db = getMarketingSequelize();
  const suffix = Date.now();
  const slug = `ps-test-${suffix}`;
  const firstSlug = `ps-first-${suffix}`;
  const site = `ps-site-${suffix}`;
  const v = (k) => `ps-visitor-${k}-${suffix}`;
  const s = (k) => `ps-session-${k}-${suffix}`;
  const orderId = 2100000000 + (suffix % 100000000);
  let n = 0;
  const ev = (k, eventType, ts, pathname, metadata = {}) =>
    analyticsEventsService.ingestEvent({
      id: `ev-ps-${suffix}-${(n += 1)}`,
      visitorId: v(k),
      sessionId: s(k),
      eventType,
      timestamp: ts,
      pathname,
      landingPageSlug: pathname.startsWith("/lp/") ? pathname.slice(4) : undefined,
      metadata: { site: "customer-website", deviceType: "desktop", ...metadata },
    });
  const lp = `/lp/${slug}`;

  try {
    // A: converts (view → CTA → form → submit → lead → paid order), then leaves from a site page.
    await ev("a", "landing_page_view", "2026-01-15T14:00:00Z", lp);
    await ev("a", "cta_click", "2026-01-15T14:01:00Z", lp);
    await ev("a", "form_start", "2026-01-15T14:02:00Z", lp);
    await ev("a", "form_submit", "2026-01-15T14:03:00Z", lp);
    await ev("a", "page_engagement", "2026-01-15T14:04:00Z", lp, { activeMs: 20000, maxScrollPct: 80 });
    await ev("a", "page_view", "2026-01-15T14:05:00Z", `/${site}`);
    await db.query(
      `INSERT INTO lead_submissions (landing_page_slug, visitor_id, session_id, page_url, fields, test_mode, submitted_at,
         conversion_status, revenue, converted_at)
       VALUES (?, ?, ?, ?, '{}', 0, '2026-01-15 14:03:30', 'won', 500, '2026-01-15 20:00:00')`,
      { replacements: [slug, v("a"), s("a"), `https://example.test${lp}`] },
    );
    // E: lead from an earlier day, marked won on DAY → counts as won on DAY, not as a DAY lead.
    await db.query(
      `INSERT INTO lead_submissions (landing_page_slug, visitor_id, session_id, page_url, fields, test_mode, submitted_at,
         conversion_status, revenue, converted_at)
       VALUES (?, ?, ?, ?, '{}', 0, '2026-01-10 12:00:00', 'won', 300, '2026-01-15 18:00:00')`,
      { replacements: [slug, v("e"), s("e"), `https://example.test${lp}`] },
    );
    // F: won lead from a site page form (no landing page slug) → credited to that site page.
    await db.query(
      `INSERT INTO lead_submissions (landing_page_slug, visitor_id, session_id, page_url, fields, test_mode, submitted_at,
         conversion_status, revenue, converted_at)
       VALUES (NULL, ?, ?, ?, '{}', 0, '2026-01-12 12:00:00', 'won', 100, '2026-01-15 19:00:00')`,
      { replacements: [v("f"), s("f"), `https://example.test/${site}`] },
    );
    await db.query(
      `INSERT INTO marketing_order_attribution
         (order_id, visitor_id, session_id, landing_page_slug, first_landing_page_slug, status, paid_at, revenue, order_total)
       VALUES (?, ?, ?, ?, ?, 'paid', '2026-01-15 15:00:00', 50, 50)`,
      { replacements: [orderId, v("a"), s("a"), slug, firstSlug] },
    );
    // A's second paid order (repeat), same day.
    await db.query(
      `INSERT INTO marketing_order_attribution
         (order_id, visitor_id, session_id, landing_page_slug, first_landing_page_slug, status, paid_at, revenue, order_total,
          customer_order_seq, is_repeat)
       VALUES (?, ?, ?, ?, ?, 'paid', '2026-01-15 17:00:00', 20, 20, 2, 1)`,
      { replacements: [orderId + 1, v("a"), s("a"), slug, firstSlug] },
    );
    // B: bounces (one view, 3 s engaged, no action).
    await ev("b", "landing_page_view", "2026-01-15T16:00:00Z", lp);
    await ev("b", "page_engagement", "2026-01-15T16:00:03Z", lp, { activeMs: 3000, maxScrollPct: 10 });
    // C: 23:30 New York time (still Jan 15) — starts a form without a CTA click.
    await ev("c", "landing_page_view", "2026-01-16T04:30:00Z", lp);
    await ev("c", "form_start", "2026-01-16T04:31:00Z", lp);
    // D: exactly midnight New York → Jan 16, not in the day.
    await ev("d", "landing_page_view", "2026-01-16T05:00:00Z", lp);

    await pageStats.rollupDay(DAY, TZ);
    const range = parseReportRange(DAY, DAY, TZ);
    const { rows } = await pageStats.getPageStats({ range, pageType: "landing_page", pageSlug: slug });
    const r = rows[0];
    assert(r, "landing page row missing");
    eq(r.views, 3, "views (midnight boundary excluded)");
    eq(r.visitors, 3, "visitors");
    eq(r.sessions, 3, "sessions");
    eq(r.entrances, 3, "entrances");
    eq(r.bounces, 1, "bounces");
    eq(r.bounceRate, 33, "bounceRate");
    eq(r.exits, 2, "exits");
    eq(r.avgEngagedSec, 7.7, "avgEngagedSec (23 s / 3 views)");
    eq(r.avgScrollDepth, 45, "avgScrollDepth");
    eq(r.ctaClicks, 1, "ctaClicks");
    eq(r.formStarts, 2, "formStarts");
    eq(r.formSubmissions, 1, "formSubmissions");
    eq(r.leads, 1, "leads");
    eq(r.orders, 2, "orders (last touch)");
    eq(r.revenue, 70, "revenue (last touch)");
    eq(r.repeatOrders, 1, "repeat orders");
    eq(r.repeatRevenue, 20, "repeat revenue");
    eq(r.wonLeads, 2, "won leads (by day marked won)");
    eq(r.wonRevenue, 800, "won-lead revenue");
    eq(r.customerRevenue, 870, "orders + won-lead revenue");

    const firstTouch = await pageStats.getPageStats({ range, pageType: "landing_page", pageSlug: firstSlug, touch: "first" });
    eq(firstTouch.rows[0]?.revenue, 70, "first-touch revenue");
    eq(firstTouch.rows[0]?.repeatOrders, 1, "first-touch repeat orders");
    const lastOnFirst = await pageStats.getPageStats({ range, pageType: "landing_page", pageSlug: firstSlug });
    eq(lastOnFirst.rows[0]?.revenue ?? 0, 0, "last-touch revenue on the first-touch page");

    const siteRows = await pageStats.getPageStats({ range, pageType: "site", pageSlug: site });
    eq(siteRows.rows[0]?.exits, 1, "site page exits");
    eq(siteRows.rows[0]?.entrances, 0, "site page entrances");
    eq(siteRows.rows[0]?.wonLeads, 1, "site page won lead (from page_url)");
    eq(siteRows.rows[0]?.wonRevenue, 100, "site page won revenue");

    const detail = await pageStats.getPageDetail({ range, pageType: "landing_page", pageSlug: slug });
    const steps = Object.fromEntries(detail.funnel.map((f) => [f.step, f]));
    eq(steps.view.sessions, 3, "funnel view");
    eq(steps.cta_click.sessions, 1, "funnel CTA");
    eq(steps.form_start.sessions, 1, "funnel form start (sequential)");
    eq(steps.form_start.anyOrder, 2, "funnel form start (any order)");
    eq(steps.form_submit.sessions, 1, "funnel submit");
    eq(steps.lead.sessions, 1, "funnel lead");
    eq(steps.order.sessions, 1, "funnel order");
    eq(detail.daily.length, 1, "daily series length");
    eq(detail.daily[0].views, 3, "daily views");
    eq(detail.daily[0].wonLeads, 2, "daily won leads");
    eq(detail.daily[0].customerRevenue, 870, "daily customer revenue");
    eq(detail.breakdowns.devices[0]?.name, "desktop", "device breakdown");

    const nextDay = await pageStats.getPageStats({ range: parseReportRange("2026-01-16", "2026-01-16", TZ), pageType: "landing_page", pageSlug: slug });
    eq(nextDay.rows[0]?.views, 1, "midnight event lands on the next day");

    const dashboard = await analyticsDashboardService.getDashboard({ from: DAY, to: DAY });
    const dashRow = dashboard.landingPages.find((x) => x.landingPageSlug === slug);
    assert(dashRow && dashRow.sessions === 3 && dashRow.revenue === 70 && dashRow.bounceRate === 33, `dashboard landing page row ${JSON.stringify(dashRow)}`);
    assert(dashRow.wonLeads === 2 && dashRow.repeatOrders === 1 && dashRow.customerRevenue === 870, "dashboard won/repeat columns");
    const dashFirst = await analyticsDashboardService.getDashboard({ from: DAY, to: DAY, touch: "first" });
    assert(dashFirst.landingPages.find((x) => x.landingPageSlug === firstSlug)?.revenue === 70, "dashboard first touch");
    eq(dashboard.meta.timeZone, TZ, "dashboard meta timezone");
  } finally {
    const visitors = ["a", "b", "c", "d", "e", "f"].map(v);
    await db.query("DELETE FROM marketing_analytics_events WHERE visitor_id IN (?)", { replacements: [visitors] });
    await db.query("DELETE FROM marketing_sessions WHERE visitor_id IN (?)", { replacements: [visitors] });
    await db.query("DELETE FROM marketing_visitors WHERE visitor_id IN (?)", { replacements: [visitors] });
    await db.query("DELETE FROM lead_submissions WHERE visitor_id IN (?)", { replacements: [visitors] });
    await db.query("DELETE FROM marketing_order_attribution WHERE order_id IN (?)", { replacements: [[orderId, orderId + 1]] });
    await db.query("DELETE FROM marketing_daily_page_stats WHERE stat_date IN ('2026-01-15', '2026-01-16')");
    await db.query("DELETE FROM marketing_daily_rollup_runs WHERE stat_date IN ('2026-01-15', '2026-01-16')");
  }
  const [left] = await db.query(
    "SELECT COUNT(*) AS c FROM marketing_daily_page_stats WHERE page_slug LIKE 'ps-%'",
    { type: QueryTypes.SELECT },
  );
  eq(Number(left.c), 0, "cleanup");

  // eslint-disable-next-line no-console
  console.log("[page-stats] passed");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[page-stats] failed:", error.message);
    process.exit(1);
  });
