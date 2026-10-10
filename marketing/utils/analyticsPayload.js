function pickString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

/** Visitor / session / event ids: short opaque tokens only (uuid-, nanoid- or tp_…-style). */
const IDENTITY = /^[A-Za-z0-9_.:-]+$/;
function cleanIdentity(value, max = 64) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const id = String(value).trim();
  return id && id.length <= max && IDENTITY.test(id) ? id : "";
}

/**
 * Server-validated event time: the browser's clock is used only when it is plausible (up to 24h
 * old — buffered/offline events — and at most 2 minutes ahead); otherwise the receive time.
 */
const MAX_CLIENT_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_CLIENT_SKEW_MS = 2 * 60 * 1000;
function serverTimestamp(value, now = new Date()) {
  const t = typeof value === "string" || typeof value === "number" ? Date.parse(String(value)) : NaN;
  if (!Number.isFinite(t)) return now;
  if (t > now.getTime() + MAX_CLIENT_SKEW_MS || t < now.getTime() - MAX_CLIENT_AGE_MS) return now;
  return new Date(t);
}

/** decodeURIComponent that never throws (a malformed %-sequence must not become a 500). */
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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

const KNOWN_SITES = new Set(["customer-website", "campaign-lp", "campaign-preview", "server"]);

/** `/products/detail/foo` -> `products-detail-foo`, `/` -> `home` (matches the website tracker). */
function pathnameToPageSlug(pathname) {
  const clean = String(pathname || "").split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
  return clean ? clean.replace(/\//g, "-").slice(0, 200) : "home";
}

/**
 * Where an event/touchpoint happened, derived server-side so a client can never tag an
 * ordinary site page as a landing page (the old website tracker did — "home", "products").
 *   pageType        "landing_page" for /lp/{slug}, else "site"
 *   pageSlug        page key for every page
 *   landingPageSlug/Id  only kept for landing-page events
 * Events without a pathname (server-side events such as orders) keep what they were given.
 */
function resolvePageContext(payload = {}) {
  const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
  const siteRaw = pickString(payload.site || metadata.site).trim();
  const site = KNOWN_SITES.has(siteRaw) ? siteRaw : null;
  const pathname = pickString(payload.pathname).trim().slice(0, 500);
  const givenSlug = pickString(payload.landingPageSlug || payload.landing_page_slug || payload.landingPage).trim();
  const givenId = pickString(payload.landingPageId || payload.landing_page_id).trim();

  if (!pathname) {
    // Not a page event (e.g. server-side order events): the landing page is attribution only.
    return {
      site,
      pathname: null,
      pageType: null,
      pageSlug: null,
      landingPageSlug: givenSlug ? givenSlug.slice(0, 200) : null,
      landingPageId: givenId ? givenId.slice(0, 64) : null,
    };
  }

  const lpMatch = pathname.match(/^\/lp\/([^/?#]+)/);
  if (lpMatch) {
    const slug = safeDecode(lpMatch[1]).slice(0, 200);
    return { site, pathname, pageType: "landing_page", pageSlug: slug, landingPageSlug: slug, landingPageId: givenId ? givenId.slice(0, 64) : null };
  }
  return { site, pathname, pageType: "site", pageSlug: pathnameToPageSlug(pathname), landingPageSlug: null, landingPageId: null };
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
  cleanIdentity,
  serverTimestamp,
  safeDecode,
  normalizeAttribution,
  normalizeMetadata,
  normalizeLeadFields,
  resolvePageContext,
  pathnameToPageSlug,
};
