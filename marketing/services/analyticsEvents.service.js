const { UniqueConstraintError } = require("sequelize");
const { getAnalyticsEventModel } = require("../models/analyticsEvent");
const { touchIdentity } = require("./visitors.service");
const {
  pickString,
  normalizeAttribution,
  normalizeMetadata,
  resolvePageContext,
  cleanIdentity,
  serverTimestamp,
} = require("../utils/analyticsPayload");
const { cleanUrl, cleanClickIds, str, compact } = require("../utils/attribution");
const {
  MAX_METADATA_BYTES,
  COMMERCE_EVENT_TYPES,
  productIdFromPath,
  cleanProductId,
  cleanCustomerId,
  cleanCommerceMetadata,
} = require("../utils/productEvents");

const EVENT_TYPE = /^[a-z][a-z0-9_]{0,63}$/;
const ATTRIBUTION_KEYS = {
  source: 100, medium: 100, campaign: 255, content: 255, term: 500, channel: 100, category: 64,
  landingPage: 200, referrer: 2048,
};
const UTM_KEYS = { utmSource: 100, utmMedium: 100, utmCampaign: 255, utmContent: 255, utmTerm: 500 };

/** Known keys only, strings capped (the browser's attribution is a claim, stored as sent but bounded). */
function cleanFields(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, max] of Object.entries(keys)) {
    const v = key === "referrer" ? cleanUrl(value[key]) : str(value[key], max);
    if (v) out[key] = v;
  }
  return compact(out);
}

/**
 * Browser events: server-validated time (utils/analyticsPayload.serverTimestamp). Server-side
 * callers (order events, backfills, tests) pass real historical times and keep them.
 */
function eventTime(value, now, fromBrowser) {
  if (fromBrowser) return serverTimestamp(value, now);
  if (!value) return now;
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) {
    const error = new Error("timestamp must be a valid ISO date.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  return t;
}

/**
 * Campaign Builder canvas / preview traffic: kept (clearly marked) but out of every report —
 * page_type "preview" is never a reported page type, and it doesn't touch visitors/sessions.
 */
function isEditorTraffic(pathname, { staff = false } = {}) {
  return staff || /^\/(preview|admin)(\/|$)/.test(String(pathname || ""));
}

/**
 * @param {object} payload
 * @param {{ touchIdentity?: boolean, staff?: boolean }} [options] touchIdentity=false for server
 *   events that happen after the visit (e.g. a payment days later): the event is stored without
 *   moving the session's end or the visitor's last-seen time. staff: the request carries a
 *   Campaign Builder session (editor traffic). fromBrowser: the public endpoint — the browser's
 *   clock is only used when plausible (server time otherwise).
 */
async function ingestEvent(payload, { touchIdentity: updateIdentity = true, staff = false, fromBrowser = false } = {}) {
  const id = cleanIdentity(payload?.id, 80);
  if (!id) {
    const error = new Error("id is required.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  const visitorId = cleanIdentity(payload?.visitorId, 64);
  const sessionId = cleanIdentity(payload?.sessionId, 64);
  const eventType = pickString(payload?.eventType).trim();
  if (!visitorId || !sessionId || !eventType) {
    const error = new Error("visitorId, sessionId, and eventType are required.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  if (!EVENT_TYPE.test(eventType)) {
    const error = new Error("eventType is invalid.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  const AnalyticsEvent = getAnalyticsEventModel();
  const existing = await AnalyticsEvent.findByPk(id);
  if (existing) return { stored: false, duplicate: true };

  const now = new Date();
  const timestamp = eventTime(payload.timestamp, now, fromBrowser);

  // Page context is derived server-side from the pathname (landing-page fields only on /lp).
  const page = resolvePageContext(payload);
  const editor = isEditorTraffic(page.pathname, { staff });
  if (editor) {
    page.pageType = "preview";
    page.site = "campaign-preview";
  }

  let metadata = normalizeMetadata(payload);
  if (COMMERCE_EVENT_TYPES.has(eventType)) metadata = cleanCommerceMetadata(eventType, metadata);
  if (JSON.stringify(metadata).length > MAX_METADATA_BYTES) {
    const error = new Error("metadata is too large.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  if (timestamp === now && payload.timestamp) metadata.clientTimestamp = str(payload.timestamp, 40);
  // Views of the website's "not found" page are kept out of page reports (Broken links report).
  if (metadata.notFound === true && page.pageType === "site") page.pageType = "not_found";
  // Product: from the product page URL, or the cart event's own product id.
  const productId =
    (page.pageType === "site" ? productIdFromPath(page.pathname) : null) || cleanProductId(metadata.productId);
  // Only sent by the website when the visitor allowed analytics cookies.
  const customerUserId = cleanCustomerId(payload.customerUserId ?? metadata.customerUserId);

  const identity = { ...payload, visitorId, sessionId };
  if (updateIdentity && !editor) await touchIdentity(identity, timestamp, { eventType, page });

  try {
    await AnalyticsEvent.create({
      id,
      visitorId,
      sessionId,
      eventType,
      timestamp,
      pageUrl: (cleanUrl(payload.pageUrl) || "").slice(0, 2000) || null,
      pathname: page.pathname,
      landingPageId: page.landingPageId,
      landingPageSlug: page.landingPageSlug,
      pageSlug: page.pageSlug,
      pageType: page.pageType,
      productId,
      customerUserId,
      site: page.site,
      attribution: cleanFields(normalizeAttribution(payload), ATTRIBUTION_KEYS),
      firstTouchUtm: cleanFields(payload.firstTouchUtm, UTM_KEYS),
      lastTouchUtm: cleanFields(payload.lastTouchUtm, UTM_KEYS),
      clickIds: cleanClickIds(payload.clickIds),
      metadata,
    });
  } catch (error) {
    // Same event posted twice at once (retry, keepalive + normal send): the first insert wins.
    if (error instanceof UniqueConstraintError) return { stored: false, duplicate: true };
    throw error;
  }

  return { stored: true, duplicate: false, preview: editor };
}

function formatEventRow(row) {
  return {
    id: row.id,
    visitorId: row.visitorId,
    sessionId: row.sessionId,
    eventType: row.eventType,
    timestamp: row.timestamp,
    pageUrl: row.pageUrl || "",
    pathname: row.pathname || "",
    landingPageId: row.landingPageId || null,
    landingPageSlug: row.landingPageSlug || "",
    pageSlug: row.pageSlug || "",
    pageType: row.pageType || "",
    site: row.site || "",
    attribution: row.attribution || {},
    firstTouchUtm: row.firstTouchUtm || {},
    lastTouchUtm: row.lastTouchUtm || {},
    clickIds: row.clickIds || {},
    metadata: row.metadata || {},
  };
}

module.exports = {
  ingestEvent,
  isEditorTraffic,
  eventTime,
  formatEventRow,
};
