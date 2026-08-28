const { getAnalyticsEventModel } = require("../models/analyticsEvent");
const { touchIdentity } = require("./visitors.service");
const {
  pickString,
  normalizeAttribution,
  normalizeMetadata,
} = require("../utils/analyticsPayload");

async function ingestEvent(payload) {
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

  await touchIdentity(payload, timestamp);

  await AnalyticsEvent.create({
    id,
    visitorId,
    sessionId,
    eventType,
    timestamp,
    pageUrl: pickString(payload.pageUrl) || null,
    pathname: pickString(payload.pathname) || null,
    landingPageId: pickString(payload.landingPageId) || null,
    landingPageSlug:
      pickString(payload.landingPageSlug || payload.landingPage) || null,
    attribution: normalizeAttribution(payload),
    firstTouchUtm: payload.firstTouchUtm || {},
    lastTouchUtm: payload.lastTouchUtm || {},
    clickIds: payload.clickIds || {},
    metadata: normalizeMetadata(payload),
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
