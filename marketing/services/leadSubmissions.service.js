const { sendMailPromise } = require("../../helper/transpoter");
const { leadIpForStorage } = require("../utils/requestMeta");
const { sendIfAllowed, hqPerson } = require("../../utils/emailSendGate");
const { getLeadSubmissionModel } = require("../models/leadSubmission");
const { UniqueConstraintError } = require("sequelize");
const { getLandingPageModel } = require("../models/landingPage");
const { cleanIdentity, resolvePageContext } = require("../utils/analyticsPayload");
const { cleanUrl, cleanTimestamp, str } = require("../utils/attribution");
const { decideLeadTestMode } = require("./leadTestMode.service");
const {
  resolveLeadAttribution,
  leadAttributionColumns,
  legacyAttributionJson,
} = require("./leadAttribution.service");

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

/** Lead values are visitor input: escape before putting them in the staff notification email. */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLeadEmailHtml(fields, pageUrl, submittedAt) {
  const rows = Object.entries(fields || {})
    .map(
      ([key, value]) =>
        `<tr><td><strong>${escapeHtml(key)}</strong></td><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  return `
    <h3>New Landing Page Lead</h3>
    <p><strong>Page URL:</strong> ${escapeHtml(pageUrl)}</p>
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
    convertedAt: row.convertedAt || null,
    revenue:
      row.revenue !== null && row.revenue !== undefined ? Number(row.revenue) : null,
    profit:
      row.profit !== null && row.profit !== undefined ? Number(row.profit) : null,
    notes: row.notes || null,
    updatedAt: row.updatedAt || row.createdAt || row.submittedAt,
    utmSource: row.source || attribution.utmSource || "",
    utmMedium: row.medium || attribution.utmMedium || "",
    utmCampaign: row.campaign || attribution.utmCampaign || "",
    leadId: formatLeadId(row.id),
    eventId: row.eventId || null,
    formId: row.formId || null,
    sectionId: row.sectionId || null,
    clientSubmittedAt: row.clientSubmittedAt || null,
    createdAt: row.createdAt || row.submittedAt,
    // Lead source = last non-direct touch, else the converting visit's own source.
    channel: row.channel || null,
    source: row.source || null,
    medium: row.medium || null,
    campaign: row.campaign || null,
    content: row.content || null,
    term: row.term || null,
    touches: {
      first: row.firstTouch || null,
      last: row.lastTouch || null,
      lastNonDirect: row.lastNonDirectTouch || null,
      session: row.sessionTouch || null,
      conversion: row.conversionTouch || null,
    },
    firstTouch: { source: row.firstTouchSource || null, medium: row.firstTouchMedium || null, channel: row.firstTouchChannel || null },
    lastTouch: { source: row.lastTouchSource || null, medium: row.lastTouchMedium || null, channel: row.lastTouchChannel || null },
    lastNonDirectTouch: { source: row.lndSource || null, medium: row.lndMedium || null, channel: row.lndChannel || null },
    clickIds: {
      gclid: row.gclid || null,
      gbraid: row.gbraid || null,
      wbraid: row.wbraid || null,
      dclid: row.dclid || null,
      fbclid: row.fbclid || null,
      msclkid: row.msclkid || null,
      ttclid: row.ttclid || null,
      liFatId: row.liFatId || null,
      twclid: row.twclid || null,
    },
    clickIdRecords: row.clickIds || null,
    referrerUrl: row.referrerUrl || null,
    referrerDomain: row.referrerDomain || null,
    firstLandingPage: row.firstLandingPage || null,
    sessionLandingPage: row.sessionLandingPage || null,
    rawLandingUrl: row.landingPageUrl || null,
    conversionPage: row.conversionPage || null,
    rawQueryString: row.rawQuery || null,
    attributionConflict: Boolean(row.attributionConflict),
    attributionBasis: row.attributionBasis || null,
    deviceType: device.deviceType || "",
    browser: device.browser || "",
    os: device.os || "",
  };
}

const HONEYPOT_FIELD = "bb_hp";
const MAX_FIELDS = 50;
const MAX_FIELD_KEY = 100;
const MAX_FIELD_VALUE = 5000;
const MAX_FIELDS_BYTES = 32 * 1024;
const FORM_ID = /^[A-Za-z0-9_.:-]{1,100}$/;
const EVENT_ID = /^[A-Za-z0-9-]{8,64}$/;

function validationError(message) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  return error;
}

/** Visitor-entered fields: plain strings, bounded; the honeypot is removed (never stored). */
function cleanLeadFields(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw validationError("fields must be an object.");
  const entries = Object.entries(raw);
  if (entries.length > MAX_FIELDS) throw validationError("Too many fields.");
  const fields = {};
  let honeypot = "";
  for (const [key, value] of entries) {
    if (value !== null && typeof value === "object") throw validationError("Field values must be text.");
    const k = String(key).trim();
    if (!k || k.length > MAX_FIELD_KEY) throw validationError("Field names must be 1-100 characters.");
    const v = value === null || value === undefined ? "" : String(value);
    if (v.length > MAX_FIELD_VALUE) throw validationError(`Field ${k} is too long.`);
    if (k === HONEYPOT_FIELD) honeypot = v;
    else fields[k] = v;
  }
  if (JSON.stringify(fields).length > MAX_FIELDS_BYTES) throw validationError("The form is too large.");
  return { fields, honeypot };
}

const DEVICE_KEYS = { userAgent: 500, deviceType: 32, browser: 64, browserVersion: 32, os: 64, language: 32, timezone: 64 };
function cleanDevice(payload) {
  const d = buildDevice(payload);
  const out = {};
  for (const [key, max] of Object.entries(DEVICE_KEYS)) if (d[key]) out[key] = String(d[key]).slice(0, max);
  for (const key of ["screenWidth", "screenHeight"]) {
    const n = Number(d[key]);
    if (Number.isFinite(n) && n > 0 && n < 100000) out[key] = Math.round(n);
  }
  return out;
}

async function findByEventId(eventId) {
  if (!eventId) return null;
  return getLeadSubmissionModel().findOne({ where: { eventId }, attributes: ["id", "testMode"] });
}

function duplicateResponse(row) {
  const id = formatLeadId(row.id);
  return { id, leadId: id, stored: true, testMode: Boolean(row.testMode), duplicate: true };
}

/** The lead's lead_created event, recorded by the server (site-page lead counts read it). */
async function recordLeadCreatedEvent({ eventId, leadId, visitorId, sessionId, pageUrl, attributed, formId }) {
  if (!visitorId || !sessionId) return;
  // Lazy require: analyticsEvents.service pulls in the visitor/session services.
  // eslint-disable-next-line global-require
  const { ingestEvent } = require("./analyticsEvents.service");
  let pathname;
  try {
    pathname = new URL(pageUrl).pathname;
  } catch {
    return;
  }
  try {
    await ingestEvent({
      id: `lead-${eventId || leadId}`,
      visitorId,
      sessionId,
      eventType: "lead_created",
      pathname,
      pageUrl,
      site: "customer-website",
      attribution: attributed
        ? { source: attributed.source, medium: attributed.medium, campaign: attributed.campaign, channel: attributed.channel }
        : {},
      metadata: { leadId, ...(formId ? { formId } : {}), ...(eventId ? { eventId } : {}) },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[lead] lead_created event not recorded:", error.message);
  }
}

/**
 * Real leads also go on the admin panel Leads Dashboard (Kanban): linked to the lead the website's
 * form already created there (same event id), or created (product quote / landing page forms).
 * Never fails the submission.
 */
async function linkToSalesPipeline(input) {
  try {
    // Lazy: commerce models are not loaded in marketing-only scripts.
    // eslint-disable-next-line global-require
    const { linkOrCreateFromMarketing } = require("../../utils/leadPipeline");
    await linkOrCreateFromMarketing(input);
  } catch (error) {
    console.error("lead → sales pipeline failed:", error.message);
  }
}

/**
 * Store a lead. The browser supplies the visitor's form fields and its attribution CLAIM; the
 * server decides everything else:
 *   - test mode (Campaign Builder session or a valid preview token, services/leadTestMode),
 *   - the creation time (submitted_at = now; the browser clock is kept in client_submitted_at),
 *   - attribution (validated, re-classified, reconciled with its own visitor/session records),
 *   - spam: a filled honeypot gets a normal-looking response and nothing is stored.
 * Retries are idempotent on event_id.
 *
 * @param {object} payload
 * @param {{ ip?: string, userAgent?: string, authorization?: string }} [requestMeta] from the
 *   HTTP request (not the body)
 */
async function submitLead(payload, requestMeta = {}) {
  const pageUrl = cleanUrl(payload?.pageUrl);
  if (!pageUrl) throw validationError("pageUrl must be a valid http(s) URL.");

  const { fields, honeypot } = cleanLeadFields(payload?.fields);
  const trap = honeypot || (typeof payload?.honeypot === "string" ? payload.honeypot : "");
  if (trap.trim()) {
    // Bot: looks accepted (so it doesn't retry or adapt); testMode tells the page not to fire
    // conversion tags. Nothing is stored or emailed.
    return { id: null, leadId: null, stored: true, testMode: true };
  }

  const eventId = EVENT_ID.test(String(payload?.eventId || "")) ? String(payload.eventId) : null;
  const existing = await findByEventId(eventId);
  if (existing) return duplicateResponse(existing);

  const now = new Date();
  const clientSubmittedAt = cleanTimestamp(payload?.clientSubmittedAt ?? payload?.submittedAt, now.getTime()) || null;
  const slugFromUrl = parseLandingPageSlugFromUrl(pageUrl);
  const givenSlug = str(payload.landingPageSlug || payload.landing_page_slug, 200);
  const landingPageSlug = (givenSlug || slugFromUrl || "").toLowerCase() || null;
  const givenPageId = str(payload.landingPageId || payload.landing_page_id, 64);
  const landingPageId = givenPageId || (await resolveLandingPageIdBySlug(landingPageSlug)) || null;

  const { testMode, reason: testReason } = await decideLeadTestMode({
    authorization: requestMeta.authorization,
    previewToken: payload.previewToken,
    landingPageId: givenPageId,
    landingPageSlug,
  });

  const visitorId = cleanIdentity(payload.visitorId, 64) || null;
  const sessionId = cleanIdentity(payload.sessionId, 64) || null;
  const resolved = await resolveLeadAttribution(payload, { visitorId, sessionId, pageUrl, now });
  // Website sends formId + sectionId; the Campaign Builder sends formSectionId (and formId only
  // when the form has its own id). Same rule as the website: form = its id, else its section.
  const cleanFormKey = (value) => (FORM_ID.test(String(value || "")) ? String(value) : null);
  const sectionId = cleanFormKey(payload.sectionId) || cleanFormKey(payload.formSectionId);
  const formId = cleanFormKey(payload.formId) || sectionId;

  const pageKey = resolvePageContext({ pathname: new URL(pageUrl).pathname });
  const LeadSubmission = getLeadSubmissionModel();
  let row;
  try {
    row = await LeadSubmission.create({
      landingPageId,
      landingPageSlug,
      // Same page key as analytics events (form / conversion-page reports).
      pageType: pageKey.pageType,
      pageSlug: pageKey.pageSlug,
      pageUrl: pageUrl.slice(0, 2000),
      fields,
      testMode,
      submittedAt: now,
      clientSubmittedAt: clientSubmittedAt ? new Date(clientSubmittedAt) : null,
      eventId,
      formId,
      sectionId,
      visitorId,
      sessionId,
      ...leadAttributionColumns(resolved),
      attribution: legacyAttributionJson(resolved, {
        landingPageSlug,
        landingPageId,
        ...(testReason ? { testReason } : {}),
      }),
      device: cleanDevice(payload),
      conversionStatus: "new",
      submitStatus: "success",
      ipAddress: leadIpForStorage(requestMeta.ip),
      userAgent: requestMeta.userAgent ? String(requestMeta.userAgent).slice(0, 500) : null,
    });
  } catch (error) {
    // Same submission twice at once (double click + retry): the first insert wins.
    if (error instanceof UniqueConstraintError && eventId) {
      const first = await findByEventId(eventId);
      if (first) return duplicateResponse(first);
    }
    throw error;
  }

  const leadId = formatLeadId(row.id);
  if (!testMode) {
    await recordLeadCreatedEvent({ eventId, leadId, visitorId, sessionId, pageUrl, attributed: resolved.attributed, formId });
    const to = process.env.LEAD_NOTIFICATION_TO || process.env.LEAD_NOTIFICATION_FROM;
    const from = process.env.LEAD_NOTIFICATION_FROM;
    if (to && from) {
      const html = buildLeadEmailHtml(fields, pageUrl, now);
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
    await linkToSalesPipeline({ eventId, fields, formId, pageType: pageKey.pageType, pageSlug: landingPageSlug || pageKey.pageSlug, pageUrl });
  }

  return { id: leadId, leadId, stored: true, testMode };
}

module.exports = {
  submitLead,
  formatLeadRow,
  formatLeadId,
  parseLeadId,
  buildAttribution,
  buildDevice,
  cleanLeadFields,
  HONEYPOT_FIELD,
};
