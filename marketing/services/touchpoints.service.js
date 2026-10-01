const { UniqueConstraintError } = require("sequelize");
const { getTouchpointModel } = require("../models/touchpoint");
const { getSessionModel } = require("../models/session");
const { touchIdentity, recordSessionTouch, recordVisitorTouch } = require("./visitors.service");
const { normalizeAttribution, resolvePageContext, cleanIdentity } = require("../utils/analyticsPayload");
const { isEditorTraffic, eventTime } = require("./analyticsEvents.service");
const { normalizeTouch, touchFromLegacy, channelToCategory, cleanUrl, str } = require("../utils/attribution");

/**
 * The acquisition touch of a touchpoint, re-derived by the server: UTMs / click IDs from the raw
 * landing URL, channel re-classified, lengths capped. The browser's source/medium/channel are
 * not trusted. Older clients without a landing URL fall back to their (sanitized) flat fields.
 */
function touchOf(payload, now) {
  const given = payload.touch && typeof payload.touch === "object" && !Array.isArray(payload.touch) ? payload.touch : {};
  const touch = normalizeTouch(
    {
      ...given,
      landingUrl: given.landingUrl || payload.pageUrl,
      referrer: given.referrer ?? payload.referrer,
      timestamp: given.timestamp || payload.timestamp,
    },
    { now: now.getTime() },
  );
  if (touch && (touch.landingUrl || touch.channel !== "Direct" || !payload.source)) return touch;
  const attribution = normalizeAttribution(payload);
  return (
    touchFromLegacy({
      source: payload.source || attribution.source,
      medium: payload.medium || attribution.medium,
      campaign: payload.campaign || attribution.campaign,
      content: payload.content || attribution.content,
      term: payload.term || attribution.term,
      referrer: payload.referrer || attribution.referrer,
      category: payload.category || attribution.category,
      clickIds: payload.clickIds,
    }) || touch
  );
}

const CAMPAIGN_PARAM = /[?&](utm_[a-z_]+|gclid|gbraid|wbraid|dclid|fbclid|msclkid|ttclid|li_fat_id|twclid|sccid|epik|rdt_cid|affiliate_id|partner_id)=/i;

/** The touch came from UTMs / an ad click ID / affiliate params (not just a referrer or nothing). */
function hasCampaignParams(touch) {
  if (touch.landingUrl) return CAMPAIGN_PARAM.test(touch.landingUrl);
  return Boolean(touch.campaign || Object.keys(touch.clickIds || {}).length || (touch.source && touch.source !== "direct" && !touch.referrerDomain));
}

/**
 * @param {object} payload
 * @param {{ staff?: boolean }} [options] staff: the request carries a Campaign Builder session.
 *   Editor / preview traffic creates no touchpoint (it would count as a visit in reports).
 *   fromBrowser: the public endpoint (browser clock only used when plausible).
 */
async function ingestTouchpoint(payload, { staff = false, fromBrowser = false } = {}) {
  const id = cleanIdentity(payload?.id, 80);
  if (!id) {
    const error = new Error("id is required.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  const visitorId = cleanIdentity(payload?.visitorId, 64);
  const sessionId = cleanIdentity(payload?.sessionId, 64);
  if (!visitorId || !sessionId) {
    const error = new Error("visitorId and sessionId are required.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  const Touchpoint = getTouchpointModel();
  const existing = await Touchpoint.findByPk(id);
  if (existing) return { stored: false, duplicate: true };

  const now = new Date();
  const timestamp = eventTime(payload.timestamp, now, fromBrowser);
  const touch = { ...touchOf(payload, now), receivedAt: now.toISOString() };
  const page = resolvePageContext(payload);
  if (isEditorTraffic(page.pathname, { staff })) return { stored: false, duplicate: false, preview: true };
  // Internal navigation is never an acquisition touch. In a session that already has its
  // acquisition touch, a touchpoint without campaign parameters that is either Direct or carries
  // the session's own entry referrer is just another page of that visit (older Campaign Builder
  // bundles sent one per page view, re-reading document.referrer): it must not become a false
  // Direct / referral "last touch".
  if (!hasCampaignParams(touch)) {
    const prior = await getSessionModel().findByPk(sessionId, { attributes: ["sessionId", "channel", "touch"] });
    const sameReferrer = touch.referrerDomain && touch.referrerDomain === prior?.touch?.referrerDomain;
    if (prior?.channel && (touch.channel === "Direct" || sameReferrer)) {
      return { stored: false, duplicate: false, internal: true };
    }
  }
  const identity = { ...payload, visitorId, sessionId };

  await touchIdentity(identity, timestamp, { page });

  try {
    await Touchpoint.create({
      id,
      visitorId,
      sessionId,
      timestamp,
      source: touch.source || "direct",
      medium: touch.medium || "",
      campaign: touch.campaign || "",
      content: touch.content || "",
      term: (touch.term || "").slice(0, 255),
      referrer: touch.referrer || "",
      landingPage: page.landingPageSlug || null,
      landingPageId: page.landingPageId ? String(page.landingPageId).slice(0, 64) : null,
      pageUrl: cleanUrl(payload.pageUrl) || touch.landingUrl || null,
      pathname: page.pathname ? page.pathname.slice(0, 500) : null,
      pageTitle: str(payload.pageTitle, 500) || null,
      category: channelToCategory(touch.channel),
      channel: touch.channel,
      touch,
      attributionConflict: Boolean(touch.conflict),
      clickIds: touch.clickIds || {},
      isLandingPage: page.pageType === "landing_page",
    });
  } catch (error) {
    // Same touchpoint posted twice at once (retry / two tabs): the first insert wins.
    if (error instanceof UniqueConstraintError) return { stored: false, duplicate: true };
    throw error;
  }

  await recordSessionTouch(sessionId, touch);
  await recordVisitorTouch(visitorId, touch);

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
    channel: row.channel || null,
    clickIds: row.clickIds || {},
    isLandingPage: row.isLandingPage,
  };
}

module.exports = {
  ingestTouchpoint,
  formatTouchpointRow,
  touchOf,
};
