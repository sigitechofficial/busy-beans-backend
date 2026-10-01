require("dotenv").config();
const jwt = require("jsonwebtoken");
const { getMarketingJwtSecret } = require("../services/auth.service");
const touchpointsService = require("../services/touchpoints.service");
const analyticsEventsService = require("../services/analyticsEvents.service");
const leadSubmissionsService = require("../services/leadSubmissions.service");
const analyticsDashboardService = require("../services/analyticsDashboard.service");
const leadSubmissionsAdminService = require("../services/leadSubmissionsAdmin.service");

async function run() {
  const suffix = Date.now();
  const visitorId = `contract-visitor-${suffix}`;
  const sessionId = `contract-session-${suffix}`;
  const ts = new Date().toISOString();
  const slug = "contract-test-slug";

  await touchpointsService.ingestTouchpoint({
    id: `tp-contract-${suffix}`,
    visitorId,
    sessionId,
    timestamp: ts,
    source: "instagram",
    medium: "paid_social",
    campaign: "contract-campaign",
    landingPage: slug,
    isLandingPage: true,
  });

  await analyticsEventsService.ingestEvent({
    id: `ev-view-contract-${suffix}`,
    visitorId,
    sessionId,
    eventType: "landing_page_view",
    timestamp: ts,
    landingPageSlug: slug,
    attribution: { source: "instagram", campaign: "contract-campaign" },
    metadata: { deviceType: "desktop", depthPct: 50 },
  });

  await analyticsEventsService.ingestEvent({
    id: `ev-lead-contract-${suffix}`,
    visitorId,
    sessionId,
    eventType: "lead_created",
    timestamp: ts,
    landingPageSlug: slug,
  });

  const testLead = await leadSubmissionsService.submitLead({
    fields: { name: "Contract Test", email: "contract@example.com", utm_source: "" },
    pageUrl: `https://example.com/lp/${slug}?utm_source=instagram`,
    submittedAt: ts,
    visitorId,
    sessionId,
    trafficCategory: "paid_social",
  }, {
    // Test mode is decided by the server: a Campaign Builder session marks the lead as a test.
    authorization: `Bearer ${jwt.sign({ id: 0, scope: "marketing" }, getMarketingJwtSecret(), { expiresIn: "5m" })}`,
  });
  if (!testLead.testMode) throw new Error("Campaign Builder session must produce a test lead");

  const realLead = await leadSubmissionsService.submitLead({
    fields: { name: "Real Lead", email: "real@example.com" },
    pageUrl: `https://example.com/lp/${slug}`,
    submittedAt: ts,
    testMode: false,
    visitorId,
    sessionId,
    firstTouchSource: "instagram",
    lastTouchSource: "google",
  });

  const dashboard = await analyticsDashboardService.getDashboard({});
  const leads = await leadSubmissionsAdminService.listLeads({});

  const testInList = leads.some((row) => row.id === testLead.id);
  const realInList = leads.some((row) => row.id === realLead.id);

  if (dashboard.executive.totalLeads < 1) {
    throw new Error("Dashboard totalLeads should exclude test submissions");
  }
  if (dashboard.funnel.length !== 6) {
    throw new Error("Dashboard funnel must include 6 steps");
  }
  if (!Array.isArray(dashboard.recentTouchpoints)) {
    throw new Error("Dashboard recentTouchpoints missing");
  }
  if (!Array.isArray(dashboard.recentEvents)) {
    throw new Error("Dashboard recentEvents missing");
  }
  if (testInList) {
    throw new Error("Test lead should be excluded from default admin list");
  }
  if (!realInList) {
    throw new Error("Real lead should appear in admin list");
  }

  const funnelLeadStep = dashboard.funnel.find((step) => step.step === "lead_created");
  if (funnelLeadStep.count !== dashboard.executive.totalLeads) {
    throw new Error("Funnel lead_created count must match executive.totalLeads");
  }

  await checkPageContextContract(suffix);

  // eslint-disable-next-line no-console
  console.log("[analytics-contract] passed");
}

/**
 * Page context (Phase 7): landing-page fields only on /lp events, page fields on every event,
 * engaged time accumulated on the session. Uses its own session and removes its rows.
 */
async function checkPageContextContract(suffix) {
  const { getMarketingSequelize } = require("../db/sequelize.marketing");
  const db = getMarketingSequelize();
  const visitorId = `contract-pc-visitor-${suffix}`;
  const sessionId = `contract-pc-session-${suffix}`;
  const base = { visitorId, sessionId, metadata: { site: "customer-website" } };
  const ts = () => new Date().toISOString();

  try {
    await analyticsEventsService.ingestEvent({ ...base, id: `ev-pc-site-${suffix}`, eventType: "page_view", timestamp: ts(), pathname: "/products" });
    // What the old website tracker sent from ordinary pages: must NOT count as a landing page.
    await analyticsEventsService.ingestEvent({ ...base, id: `ev-pc-polluted-${suffix}`, eventType: "cta_click", timestamp: ts(), pathname: "/products", landingPageSlug: "products" });
    await analyticsEventsService.ingestEvent({ ...base, id: `ev-pc-lp-${suffix}`, eventType: "landing_page_view", timestamp: ts(), pathname: "/lp/contract-test-slug", landingPageSlug: "contract-test-slug", landingPageId: "lp-contract" });
    await analyticsEventsService.ingestEvent({ ...base, id: `ev-pc-eng-${suffix}`, eventType: "page_engagement", timestamp: ts(), pathname: "/lp/contract-test-slug", metadata: { site: "customer-website", activeMs: 12000 } });

    const rows = await db.query(
      "SELECT id, landing_page_slug, page_slug, page_type, site FROM marketing_analytics_events WHERE session_id = ?",
      { replacements: [sessionId], type: "SELECT" },
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    const polluted = byId[`ev-pc-polluted-${suffix}`];
    if (polluted.landing_page_slug !== null) throw new Error("Site-page event must not keep a landing_page_slug");
    if (polluted.page_slug !== "products" || polluted.page_type !== "site") throw new Error("Site-page event must record page_slug/page_type");
    const lp = byId[`ev-pc-lp-${suffix}`];
    if (lp.landing_page_slug !== "contract-test-slug" || lp.page_type !== "landing_page") throw new Error("Landing page event must keep its slug");
    if (lp.site !== "customer-website") throw new Error("Event must record the sending site");

    const [session] = await db.query(
      "SELECT entry_pathname, entry_landing_page_slug, last_landing_page_slug, page_count, engaged_ms FROM marketing_sessions WHERE session_id = ?",
      { replacements: [sessionId], type: "SELECT" },
    );
    if (session.entry_pathname !== "/products" || session.entry_landing_page_slug !== null) throw new Error("Session entry must be the first page (write-once)");
    if (session.last_landing_page_slug !== "contract-test-slug") throw new Error("Session must record the last landing page");
    if (Number(session.page_count) !== 2) throw new Error(`Session page_count should be 2, got ${session.page_count}`);
    if (Number(session.engaged_ms) !== 12000) throw new Error(`Session engaged_ms should be 12000, got ${session.engaged_ms}`);
  } finally {
    await db.query("DELETE FROM marketing_analytics_events WHERE session_id = ?", { replacements: [sessionId] });
    await db.query("DELETE FROM marketing_sessions WHERE session_id = ?", { replacements: [sessionId] });
    await db.query("DELETE FROM marketing_visitors WHERE visitor_id = ?", { replacements: [visitorId] });
  }
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[analytics-contract] failed:", error.message);
      process.exit(1);
    });
}

module.exports = { run };
