/**
 * Captures real request/response shapes for FRONTEND guide documentation.
 * Run: node marketing/scripts/captureDemoResponses.js
 */
require("dotenv").config();

const touchpointsService = require("../services/touchpoints.service");
const analyticsEventsService = require("../services/analyticsEvents.service");
const leadSubmissionsService = require("../services/leadSubmissions.service");
const leadSubmissionsAdminService = require("../services/leadSubmissionsAdmin.service");
const analyticsDashboardService = require("../services/analyticsDashboard.service");

const suffix = Date.now();
const visitorId = `demo-visitor-${suffix}`;
const sessionId = `demo-session-${suffix}`;
const ts = new Date().toISOString();
const slug = "office-coffee-demo";

async function capture() {
  const out = {
    capturedAt: new Date().toISOString(),
    public: {},
    admin: {},
    errors: {},
  };

  // Touchpoint ingest
  const touchpointPayload = {
    id: `tp-demo-${suffix}`,
    visitorId,
    sessionId,
    timestamp: ts,
    source: "instagram",
    medium: "paid_social",
    campaign: "summer2026_office",
    content: "carousel_ad_1",
    term: "",
    referrer: "https://instagram.com/",
    landingPage: slug,
    landingPageId: "lp_demo_001",
    pageUrl: `https://busybeancoffee.com/lp/${slug}?utm_source=instagram&utm_campaign=summer2026_office`,
    pathname: `/lp/${slug}`,
    pageTitle: "Office Coffee Service",
    category: "paid_social",
    clickIds: { fbclid: "demo-fbclid-123", gclid: "", ttclid: "", msclkid: "", liFatId: "" },
    isLandingPage: true,
  };
  out.public.touchpointRequest = touchpointPayload;
  out.public.touchpointResponse = { status: 204, body: null };
  await touchpointsService.ingestTouchpoint(touchpointPayload);
  out.public.touchpointDuplicateResponse = { status: 204, body: null, note: "Same id re-posted — deduped silently" };
  await touchpointsService.ingestTouchpoint(touchpointPayload);

  // Landing page view event
  const lpViewPayload = {
    id: `ev-lpview-${suffix}`,
    visitorId,
    sessionId,
    eventType: "landing_page_view",
    timestamp: ts,
    pageUrl: touchpointPayload.pageUrl,
    pathname: touchpointPayload.pathname,
    landingPageId: "lp_demo_001",
    landingPageSlug: slug,
    attribution: {
      source: "instagram",
      medium: "paid_social",
      campaign: "summer2026_office",
      category: "paid_social",
    },
    firstTouchUtm: {
      utmSource: "instagram",
      utmMedium: "paid_social",
      utmCampaign: "summer2026_office",
      utmContent: "",
      utmTerm: "",
    },
    lastTouchUtm: {
      utmSource: "instagram",
      utmMedium: "paid_social",
      utmCampaign: "summer2026_office",
      utmContent: "",
      utmTerm: "",
    },
    clickIds: { fbclid: "demo-fbclid-123", gclid: "", ttclid: "", msclkid: "", liFatId: "" },
    metadata: {
      pageTitle: "Office Coffee Service",
      browser: "Chrome",
      browserVersion: "125.0",
      os: "iOS",
      deviceType: "mobile",
      screenWidth: 390,
      screenHeight: 844,
      language: "en-US",
      timezone: "America/Los_Angeles",
      isLandingPage: true,
      isAuthenticated: false,
      accountType: "guest",
    },
  };
  out.public.landingPageViewEventRequest = lpViewPayload;
  out.public.landingPageViewEventResponse = { status: 204, body: null };
  await analyticsEventsService.ingestEvent(lpViewPayload);

  // Generic page_view (customer website non-LP page)
  const pageViewPayload = {
    id: `ev-pageview-${suffix}`,
    visitorId,
    sessionId,
    eventType: "page_view",
    timestamp: ts,
    pageUrl: "https://busybeancoffee.com/shop",
    pathname: "/shop",
    attribution: { source: "instagram", medium: "paid_social", campaign: "summer2026_office" },
    metadata: {
      pageTitle: "Shop",
      deviceType: "mobile",
      isAuthenticated: true,
      accountType: "customer",
      customerUserId: "1042",
    },
    isAuthenticated: true,
    accountType: "customer",
    customerUserId: "1042",
  };
  out.public.pageViewEventRequest = pageViewPayload;
  out.public.pageViewEventResponse = { status: 204, body: null };
  await analyticsEventsService.ingestEvent(pageViewPayload);

  // form_submit + lead_created
  const formSubmitPayload = {
    id: `ev-formsubmit-${suffix}`,
    visitorId,
    sessionId,
    eventType: "form_submit",
    timestamp: ts,
    landingPageSlug: slug,
    pathname: `/lp/${slug}`,
  };
  const leadCreatedPayload = {
    id: `ev-leadcreated-${suffix}`,
    visitorId,
    sessionId,
    eventType: "lead_created",
    timestamp: ts,
    landingPageSlug: slug,
    pathname: `/lp/${slug}`,
  };
  out.public.formSubmitEventRequest = formSubmitPayload;
  out.public.leadCreatedEventRequest = leadCreatedPayload;
  out.public.eventIngestResponse = { status: 204, body: null };
  await analyticsEventsService.ingestEvent(formSubmitPayload);
  await analyticsEventsService.ingestEvent(leadCreatedPayload);

  // Lead submission
  const leadPayload = {
    fields: {
      name: "Jane Demo",
      email: "jane.demo@example.com",
      phone: "555-0100",
      company: "Demo Corp",
      city: "Charlotte",
      utm_source: "instagram",
      utm_campaign: "summer2026_office",
    },
    pageUrl: touchpointPayload.pageUrl,
    submittedAt: ts,
    testMode: false,
    visitorId,
    sessionId,
    landingPageId: "lp_demo_001",
    landingPageSlug: slug,
    firstTouchSource: "instagram",
    firstTouchMedium: "paid_social",
    firstTouchCampaign: "summer2026_office",
    lastTouchSource: "instagram",
    lastTouchMedium: "paid_social",
    lastTouchCampaign: "summer2026_office",
    trafficCategory: "paid_social",
    fbclid: "demo-fbclid-123",
    device: {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      deviceType: "mobile",
      browser: "Chrome",
      os: "iOS",
      screenWidth: 390,
      screenHeight: 844,
      language: "en-US",
      timezone: "America/Los_Angeles",
    },
    attribution: {
      utmSource: "instagram",
      utmMedium: "paid_social",
      utmCampaign: "summer2026_office",
      landingPageSlug: slug,
      source: "instagram",
    },
  };
  out.public.leadSubmissionRequest = leadPayload;
  const leadResult = await leadSubmissionsService.submitLead(leadPayload);
  out.public.leadSubmissionResponse = { status: 200, body: { data: leadResult } };

  const testLeadPayload = { ...leadPayload, testMode: true, fields: { ...leadPayload.fields, name: "Test Mode Lead" } };
  out.public.leadSubmissionTestModeRequest = { ...testLeadPayload, fields: testLeadPayload.fields };
  const testLeadResult = await leadSubmissionsService.submitLead(testLeadPayload);
  out.public.leadSubmissionTestModeResponse = { status: 200, body: { data: testLeadResult } };

  // Admin leads
  out.public.leadListResponse = {
    status: 200,
    body: { data: await leadSubmissionsAdminService.listLeads({ includeTest: false }) },
  };
  out.public.leadListWithTestResponse = {
    status: 200,
    body: { data: await leadSubmissionsAdminService.listLeads({ includeTest: true }) },
  };
  out.public.leadGetByIdResponse = {
    status: 200,
    body: { data: await leadSubmissionsAdminService.getLeadById(leadResult.id) },
  };

  const patched = await leadSubmissionsAdminService.updateLead(leadResult.id, {
    conversionStatus: "contacted",
    revenue: 1200,
    profit: 400,
    notes: "Demo patch — called back, interested.",
  });
  out.admin.leadPatchRequest = {
    conversionStatus: "contacted",
    revenue: 1200,
    profit: 400,
    notes: "Demo patch — called back, interested.",
  };
  out.admin.leadPatchResponse = { status: 200, body: { data: patched } };

  // Dashboard
  const dashboard = await analyticsDashboardService.getDashboard({});
  out.admin.dashboardResponse = { status: 200, body: { data: dashboard } };

  // Error shapes
  out.errors.validationError = {
    status: 400,
    body: { error: "visitorId, sessionId, and eventType are required.", code: "VALIDATION_ERROR" },
  };
  out.errors.rateLimited = {
    status: 429,
    body: { error: "Too many tracking requests. Please try again shortly.", code: "RATE_LIMITED" },
  };
  out.errors.unauthorized = {
    status: 401,
    body: { error: "Authentication required", code: "UNAUTHORIZED" },
  };
  out.errors.notFound = {
    status: 404,
    body: { error: "Lead not found.", code: "NOT_FOUND" },
  };

  out.demoIds = {
    visitorId,
    sessionId,
    leadId: leadResult.id,
    testLeadId: testLeadResult.id,
  };

  return out;
}

if (require.main === module) {
  capture()
    .then((out) => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(out, null, 2));
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    });
}

module.exports = { capture };
