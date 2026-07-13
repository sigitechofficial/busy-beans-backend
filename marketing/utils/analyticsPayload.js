function pickString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function normalizeAttribution(payload = {}) {
  const nested =
    payload.attribution && typeof payload.attribution === "object"
      ? { ...payload.attribution }
      : {};
  const firstTouch =
    payload.firstTouchUtm && typeof payload.firstTouchUtm === "object"
      ? payload.firstTouchUtm
      : {};
  const lastTouch =
    payload.lastTouchUtm && typeof payload.lastTouchUtm === "object"
      ? payload.lastTouchUtm
      : {};

  return {
    ...nested,
    source:
      nested.source ||
      payload.source ||
      lastTouch.utmSource ||
      firstTouch.utmSource ||
      "",
    medium:
      nested.medium ||
      payload.utmMedium ||
      lastTouch.utmMedium ||
      firstTouch.utmMedium ||
      "",
    campaign:
      nested.campaign ||
      payload.utmCampaign ||
      lastTouch.utmCampaign ||
      firstTouch.utmCampaign ||
      "",
    content:
      nested.content ||
      payload.utmContent ||
      lastTouch.utmContent ||
      firstTouch.utmContent ||
      "",
    term:
      nested.term ||
      payload.utmTerm ||
      lastTouch.utmTerm ||
      firstTouch.utmTerm ||
      "",
    referrer: nested.referrer || payload.referrer || "",
    category: nested.category || payload.trafficCategory || "",
    landingPage:
      nested.landingPage ||
      payload.landingPageSlug ||
      payload.landingPage ||
      "",
  };
}

function normalizeMetadata(payload = {}) {
  const metadata =
    payload.metadata && typeof payload.metadata === "object"
      ? { ...payload.metadata }
      : {};

  if (!metadata.deviceType && payload.deviceType) {
    metadata.deviceType = payload.deviceType;
  }
  if (!metadata.browser && payload.browser) metadata.browser = payload.browser;
  if (!metadata.os && payload.os) metadata.os = payload.os;
  if (!metadata.language && payload.language) metadata.language = payload.language;
  if (!metadata.timezone && payload.timezone) metadata.timezone = payload.timezone;
  if (metadata.screenWidth === undefined && payload.screenWidth !== undefined) {
    metadata.screenWidth = payload.screenWidth;
  }
  if (metadata.screenHeight === undefined && payload.screenHeight !== undefined) {
    metadata.screenHeight = payload.screenHeight;
  }

  // Customer website auth context (optional — stored in metadata only)
  if (metadata.isAuthenticated === undefined && payload.isAuthenticated !== undefined) {
    metadata.isAuthenticated = Boolean(payload.isAuthenticated);
  }
  if (!metadata.accountType && payload.accountType) {
    metadata.accountType = pickString(payload.accountType);
  }
  if (metadata.customerUserId === undefined && payload.customerUserId !== undefined) {
    metadata.customerUserId =
      payload.customerUserId === null ? null : pickString(payload.customerUserId);
  }

  return metadata;
}

function normalizeLeadFields(fields) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return fields;
  }

  const normalized = {};
  for (const [key, value] of Object.entries(fields)) {
    normalized[key] = value === null || value === undefined ? "" : String(value);
  }
  return normalized;
}

module.exports = {
  pickString,
  normalizeAttribution,
  normalizeMetadata,
  normalizeLeadFields,
};
