const { getAnalyticsEventModel } = require("../models/analyticsEvent");
const { touchIdentity } = require("./visitors.service");
const {
  pickString,
  normalizeAttribution,
  normalizeMetadata,
  resolvePageContext,
} = require("../utils/analyticsPayload");
const {
  MAX_METADATA_BYTES,
  COMMERCE_EVENT_TYPES,
  productIdFromPath,
  cleanProductId,
  cleanCustomerId,
  cleanCommerceMetadata,
} = require("../utils/productEvents");

/**
 * @param {object} payload
 * @param {{ touchIdentity?: boolean }} [options] touchIdentity=false for server events that happen
 *   after the visit (e.g. a payment days later): the event is stored without moving the
 *   session's end or the visitor's last-seen time.
 */
async function ingestEvent(payload, { touchIdentity: updateIdentity = true } = {}) {
  const id = pickString(payload?.id).trim();
  if (!id) {
    const error = new Error("id is required.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  const visitorId = pickString(payload?.visitorId).trim();
  const sessionId = pickString(payload?.sessionId).trim();
  const eventType = pickString(payload?.eventType).trim();
  if (!visitorId || !sessionId || !eventType) {
    const error = new Error("visitorId, sessionId, and eventType are required.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  const AnalyticsEvent = getAnalyticsEventModel();
  const existing = await AnalyticsEvent.findByPk(id);
  if (existing) return { stored: false, duplicate: true };

  const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    const error = new Error("timestamp must be a valid ISO date.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  // Page context is derived server-side from the pathname (landing-page fields only on /lp).
  const page = resolvePageContext(payload);

  let metadata = normalizeMetadata(payload);
  if (COMMERCE_EVENT_TYPES.has(eventType)) metadata = cleanCommerceMetadata(eventType, metadata);
  if (JSON.stringify(metadata).length > MAX_METADATA_BYTES) {
    const error = new Error("metadata is too large.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  // Views of the website's "not found" page are kept out of page reports (Broken links report).
  if (metadata.notFound === true && page.pageType === "site") page.pageType = "not_found";
  // Product: from the product page URL, or the cart event's own product id.
  const productId =
    (page.pageType === "site" ? productIdFromPath(page.pathname) : null) || cleanProductId(metadata.productId);
  // Only sent by the website when the visitor allowed analytics cookies.
  const customerUserId = cleanCustomerId(payload.customerUserId ?? metadata.customerUserId);

  if (updateIdentity) await touchIdentity(payload, timestamp, { eventType, page });

  await AnalyticsEvent.create({
    id,
    visitorId,
    sessionId,
    eventType,
    timestamp,
    pageUrl: pickString(payload.pageUrl) || null,
    pathname: page.pathname,
    landingPageId: page.landingPageId,
    landingPageSlug: page.landingPageSlug,
    pageSlug: page.pageSlug,
    pageType: page.pageType,
    productId,
    customerUserId,
    site: page.site,
    attribution: normalizeAttribution(payload),
    firstTouchUtm: payload.firstTouchUtm || {},
    lastTouchUtm: payload.lastTouchUtm || {},
    clickIds: payload.clickIds || {},
    metadata,
  });

  return { stored: true, duplicate: false };
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
  formatEventRow,
};
