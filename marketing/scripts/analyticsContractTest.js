require("dotenv").config();
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
    testMode: true,
    visitorId,
    sessionId,
    trafficCategory: "paid_social",
  });

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

  // eslint-disable-next-line no-console
  console.log("[analytics-contract] passed");
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
