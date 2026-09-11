const { sendMailPromise } = require("../../helper/transpoter");
const { sendIfAllowed, hqPerson } = require("../../utils/emailSendGate");
const { getLeadSubmissionModel } = require("../models/leadSubmission");
const { getLandingPageModel } = require("../models/landingPage");
const {
  pickString,
  normalizeLeadFields,
} = require("../utils/analyticsPayload");

function parseLandingPageSlugFromUrl(pageUrl) {
  const normalized = String(pageUrl || "");
  const slugMatch = normalized.match(/\/lp\/([a-z0-9-]+)/i);
  if (!slugMatch?.[1]) return null;
  return slugMatch[1].toLowerCase();
}

function buildAttribution(payload) {
  const nested =
    payload.attribution && typeof payload.attribution === "object"
      ? { ...payload.attribution }
      : {};

  const flat = {
    utmSource: payload.utmSource || nested.utmSource,
    utmMedium: payload.utmMedium || nested.utmMedium,
    utmCampaign: payload.utmCampaign || nested.utmCampaign,
    utmTerm: payload.utmTerm || nested.utmTerm,
    utmContent: payload.utmContent || nested.utmContent,
    referrer: payload.referrer || nested.referrer,
    gclid: payload.gclid || nested.gclid,
    landingPageSlug:
      payload.landingPageSlug ||
      payload.landing_page_slug ||
      nested.landingPageSlug,
    landingPageId:
      payload.landingPageId ||
      payload.landing_page_id ||
      nested.landingPageId,
    campaignId: payload.campaignId || nested.campaignId,
    source: payload.source || nested.source,
    firstTouchSource: payload.firstTouchSource || nested.firstTouchSource,
    firstTouchMedium: payload.firstTouchMedium || nested.firstTouchMedium,
    firstTouchCampaign: payload.firstTouchCampaign || nested.firstTouchCampaign,
    firstTouchContent: payload.firstTouchContent || nested.firstTouchContent,
    firstTouchTerm: payload.firstTouchTerm || nested.firstTouchTerm,
    lastTouchSource: payload.lastTouchSource || nested.lastTouchSource,
    lastTouchMedium: payload.lastTouchMedium || nested.lastTouchMedium,
    lastTouchCampaign: payload.lastTouchCampaign || nested.lastTouchCampaign,
    lastTouchContent: payload.lastTouchContent || nested.lastTouchContent,
    lastTouchTerm: payload.lastTouchTerm || nested.lastTouchTerm,
    fbclid: payload.fbclid || nested.fbclid,
    ttclid: payload.ttclid || nested.ttclid,
    msclkid: payload.msclkid || nested.msclkid,
    liFatId: payload.liFatId || nested.liFatId,
    trafficCategory: payload.trafficCategory || nested.trafficCategory,
  };

  return { ...nested, ...flat };
}

function buildDevice(payload) {
  const nested =
    payload.device && typeof payload.device === "object" ? { ...payload.device } : {};

  return {
    ...nested,
    userAgent: nested.userAgent || payload.userAgent,
    deviceType: nested.deviceType || payload.deviceType,
    browser: nested.browser || payload.browser,
    os: nested.os || payload.os,
    screenWidth: nested.screenWidth ?? payload.screenWidth,
    screenHeight: nested.screenHeight ?? payload.screenHeight,
    language: nested.language || payload.language,
    timezone: nested.timezone || payload.timezone,
  };
}

function buildLeadEmailHtml(fields, pageUrl, submittedAt) {
  const rows = Object.entries(fields || {})
    .map(
      ([key, value]) =>
        `<tr><td><strong>${key}</strong></td><td>${String(value)}</td></tr>`,
    )
    .join("");
  return `
    <h3>New Landing Page Lead</h3>
    <p><strong>Page URL:</strong> ${pageUrl}</p>
    <p><strong>Submitted At:</strong> ${submittedAt.toISOString()}</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function resolveLandingPageIdBySlug(slug) {
  if (!slug) return null;
  const LandingPage = getLandingPageModel();
  const page = await LandingPage.findOne({ where: { slug } });
  return page?.id || null;
}

function formatLeadId(id) {
  return `sub_${id}`;
}

function parseLeadId(id) {
  const raw = String(id || "");
  if (raw.startsWith("sub_")) {
    const num = Number(raw.slice(4));
    return Number.isFinite(num) ? num : null;
  }
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function formatLeadRow(row) {
  const attribution = row.attribution || {};
  const device = row.device || {};

  return {
    id: formatLeadId(row.id),
    fields: row.fields || {},
    submittedAt: row.submittedAt,
    pageUrl: row.pageUrl,
    testMode: Boolean(row.testMode),
    submitStatus: row.submitStatus || "success",
    landingPageId: row.landingPageId || null,
    landingPageSlug: row.landingPageSlug || null,
    visitorId: row.visitorId || null,
    sessionId: row.sessionId || null,
    attribution,
    device,
    conversionStatus: row.conversionStatus || "new",
    revenue:
      row.revenue !== null && row.revenue !== undefined ? Number(row.revenue) : null,
    profit:
      row.profit !== null && row.profit !== undefined ? Number(row.profit) : null,
    notes: row.notes || null,
    updatedAt: row.updatedAt || row.createdAt || row.submittedAt,
    utmSource: attribution.utmSource || "",
    utmMedium: attribution.utmMedium || "",
    utmCampaign: attribution.utmCampaign || "",
    deviceType: device.deviceType || "",
    browser: device.browser || "",
    os: device.os || "",
  };
}

async function submitLead(payload) {
  const pageUrl = pickString(payload?.pageUrl).trim();
  const testMode = Boolean(payload?.testMode);
  const submittedAt = payload?.submittedAt ? new Date(payload.submittedAt) : new Date();

  if (!pageUrl) {
    const error = new Error("pageUrl is required.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (
    !payload?.fields ||
    typeof payload.fields !== "object" ||
    Array.isArray(payload.fields)
  ) {
    const error = new Error("fields must be an object.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (Number.isNaN(submittedAt.getTime())) {
    const error = new Error("submittedAt must be a valid ISO date.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  const fields = normalizeLeadFields(payload.fields);
  const slugFromUrl = parseLandingPageSlugFromUrl(pageUrl);
  const landingPageSlug =
    pickString(payload.landingPageSlug || payload.landing_page_slug || slugFromUrl) ||
    null;
  const landingPageId =
    pickString(payload.landingPageId || payload.landing_page_id) ||
    (await resolveLandingPageIdBySlug(landingPageSlug || slugFromUrl)) ||
    null;

  const attribution = buildAttribution(payload);
  const device = buildDevice(payload);
  const visitorId = pickString(payload.visitorId) || null;
  const sessionId = pickString(payload.sessionId) || null;

  const LeadSubmission = getLeadSubmissionModel();
  const row = await LeadSubmission.create({
    landingPageId,
    landingPageSlug,
    pageUrl,
    fields,
    testMode,
    submittedAt,
    visitorId,
    sessionId,
    attribution,
    device,
    conversionStatus: "new",
    submitStatus: "success",
  });

  if (!testMode) {
    const to = process.env.LEAD_NOTIFICATION_TO || process.env.LEAD_NOTIFICATION_FROM;
    const from = process.env.LEAD_NOTIFICATION_FROM;
    if (to && from) {
      const html = buildLeadEmailHtml(fields, pageUrl, submittedAt);
      await sendIfAllowed({
        ...hqPerson(),
        emailType: "landing_page_lead",
        recipients: to,
        send: async () => {
          await sendMailPromise({
            to,
            from,
            subject: "New Landing Page Lead",
            html,
            text: `New lead received for ${pageUrl}`,
          });
        },
      });
    }
  }

  return {
    id: formatLeadId(row.id),
    stored: true,
    testMode,
  };
}

module.exports = {
  submitLead,
  formatLeadRow,
  formatLeadId,
  parseLeadId,
  buildAttribution,
  buildDevice,
};
