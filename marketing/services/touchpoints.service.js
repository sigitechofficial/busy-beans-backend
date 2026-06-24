const { getTouchpointModel } = require("../models/touchpoint");
const { touchIdentity } = require("./visitors.service");

function pickString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

async function ingestTouchpoint(payload) {
  const id = pickString(payload?.id).trim();
  if (!id) {
    const error = new Error("id is required.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  const visitorId = pickString(payload?.visitorId).trim();
  const sessionId = pickString(payload?.sessionId).trim();
  if (!visitorId || !sessionId) {
    const error = new Error("visitorId and sessionId are required.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  const Touchpoint = getTouchpointModel();
  const existing = await Touchpoint.findByPk(id);
  if (existing) return { stored: false, duplicate: true };

  const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    const error = new Error("timestamp must be a valid ISO date.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  await touchIdentity(payload, timestamp);

  await Touchpoint.create({
    id,
    visitorId,
    sessionId,
    timestamp,
    source: pickString(payload.source, "direct"),
    medium: pickString(payload.medium),
    campaign: pickString(payload.campaign),
    content: pickString(payload.content),
    term: pickString(payload.term),
    referrer: pickString(payload.referrer),
    landingPage: pickString(payload.landingPage) || null,
    landingPageId: pickString(payload.landingPageId) || null,
    pageUrl: pickString(payload.pageUrl) || null,
    pathname: pickString(payload.pathname) || null,
    pageTitle: pickString(payload.pageTitle) || null,
    category: pickString(payload.category) || null,
    clickIds: payload.clickIds || {},
    isLandingPage: Boolean(payload.isLandingPage),
  });

  return { stored: true, duplicate: false };
}

function formatTouchpointRow(row) {
  return {
    id: row.id,
    visitorId: row.visitorId,
    sessionId: row.sessionId,
    timestamp: row.timestamp,
    source: row.source || "direct",
    medium: row.medium || "",
    campaign: row.campaign || "",
    content: row.content || "",
    term: row.term || "",
    referrer: row.referrer || "",
    landingPage: row.landingPage || "",
    landingPageId: row.landingPageId || null,
    pageUrl: row.pageUrl || "",
    pathname: row.pathname || "",
    pageTitle: row.pageTitle || "",
    category: row.category || "",
    clickIds: row.clickIds || {},
    isLandingPage: row.isLandingPage,
  };
}

module.exports = {
  ingestTouchpoint,
  formatTouchpointRow,
};
