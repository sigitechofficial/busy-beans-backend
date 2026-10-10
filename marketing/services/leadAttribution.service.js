/**
 * Lead attribution, decided by the server (spec Phase 3).
 *
 * Every touch model the browser sends is validated and re-classified (utils/attribution.js),
 * then reconciled with what the server itself recorded for the visitor and session
 * (marketing_visitors / marketing_sessions touches, written from touchpoints). Server records
 * win; the browser's claim is used only where the server has nothing (e.g. tracking requests
 * blocked) and any disagreement is flagged as an attribution conflict (diagnostic only).
 *
 *   first_touch            visitor's first touch
 *   last_touch             visitor's latest touch (may be Direct)
 *   last_non_direct_touch  latest touch that wasn't Direct
 *   session_touch          how the converting visit started
 *   conversion_touch       session touch + the conversion page and server time
 *   lead source/medium/…   last non-direct touch ?? session touch (operational source; NULL when
 *                          neither is known — the models themselves are never overwritten)
 */
const {
  CLICK_ID_KEYS,
  normalizeTouch,
  touchFromLegacy,
  cleanClickIdRecords,
  cleanUrl,
  channelToCategory,
} = require("../utils/attribution");
const { getVisitorModel } = require("../models/visitor");
const { getSessionModel } = require("../models/session");

const TOUCH_KEYS = ["first", "last", "lastNonDirect", "session"];

function clientTouches(payload, now) {
  const raw = payload.touches && typeof payload.touches === "object" && !Array.isArray(payload.touches) ? payload.touches : {};
  const out = {};
  for (const key of TOUCH_KEYS) out[key] = normalizeTouch(raw[key], { now }) || null;
  // Older clients (Campaign Builder, cached website bundles) only send flat fields.
  if (!out.first && !out.last && !out.lastNonDirect && !out.session) {
    const nested = payload.attribution && typeof payload.attribution === "object" ? payload.attribution : {};
    const clickIds = {};
    for (const key of CLICK_ID_KEYS) clickIds[key] = payload[key] ?? nested[key];
    const attributed = touchFromLegacy({
      source: nested.source || payload.lastTouchSource || nested.utmSource || payload.utmSource,
      medium: nested.medium || payload.lastTouchMedium || nested.utmMedium || payload.utmMedium,
      campaign: nested.campaign || payload.lastTouchCampaign || nested.utmCampaign || payload.utmCampaign,
      content: nested.utmContent || payload.utmContent,
      term: nested.utmTerm || payload.utmTerm,
      referrer: nested.referrer || payload.referrer,
      category: payload.trafficCategory || nested.trafficCategory,
      clickIds,
    });
    const first = touchFromLegacy({
      source: payload.firstTouchSource || nested.firstTouchSource,
      medium: payload.firstTouchMedium || nested.firstTouchMedium,
      campaign: payload.firstTouchCampaign || nested.firstTouchCampaign,
    });
    out.first = first || attributed;
    out.last = attributed;
    out.lastNonDirect = attributed && attributed.channel !== "Direct" ? attributed : null;
    out.legacy = true;
  }
  return out;
}

async function serverTouches(visitorId, sessionId) {
  const [visitor, session] = await Promise.all([
    visitorId ? getVisitorModel().findByPk(visitorId) : null,
    sessionId ? getSessionModel().findByPk(sessionId) : null,
  ]);
  // A session belongs to one visitor: a session id sent with someone else's visitor id is ignored.
  const sessionOk = session && (!visitorId || session.visitorId === visitorId);
  return {
    first: visitor?.firstTouch || null,
    last: visitor?.lastTouch || null,
    lastNonDirect: visitor?.lastNonDirectTouch || null,
    session: sessionOk ? session.touch || null : null,
    clickIds: visitor?.clickIds || {},
  };
}

function sameSource(a, b) {
  if (!a || !b) return true;
  return a.channel === b.channel && a.source === b.source && (a.campaign || "") === (b.campaign || "");
}

function flatClickIds(records, touches) {
  const out = {};
  for (const key of CLICK_ID_KEYS) {
    const value = records[key]?.value || touches.find((t) => t?.clickIds?.[key])?.clickIds[key];
    if (value) out[key] = value;
  }
  return out;
}

/** Legacy `attribution` JSON (older reports and the lead drawer read these keys). */
function legacyAttributionJson(result, extra) {
  const a = result.attributed || {};
  const f = result.first || {};
  return {
    source: a.source || "",
    medium: a.medium || "",
    campaign: a.campaign || "",
    content: a.content || "",
    term: a.term || "",
    channel: a.channel || "",
    category: a.channel ? channelToCategory(a.channel) : "",
    trafficCategory: a.channel ? channelToCategory(a.channel) : "",
    referrer: a.referrer || "",
    utmSource: a.source || "",
    utmMedium: a.medium || "",
    utmCampaign: a.campaign || "",
    utmContent: a.content || "",
    utmTerm: a.term || "",
    firstTouchSource: f.source || "",
    firstTouchMedium: f.medium || "",
    firstTouchCampaign: f.campaign || "",
    lastTouchSource: a.source || "",
    lastTouchMedium: a.medium || "",
    lastTouchCampaign: a.campaign || "",
    ...result.clickIdValues,
    basis: result.basis,
    conflicts: result.conflicts,
    ...extra,
  };
}

/**
 * @returns {Promise<object>} touches, attributed touch, click IDs, conflict flag and basis
 *   ("server" = the server's own visitor/session records, "client" = validated browser claim,
 *   "legacy" = flat fields from an older client, "none").
 */
async function resolveLeadAttribution(payload, { visitorId, sessionId, pageUrl, now = new Date() }) {
  const nowMs = now.getTime();
  const client = clientTouches(payload, nowMs);
  const server = await serverTouches(visitorId, sessionId);
  const conflicts = [];
  const pick = (key) => {
    if (server[key]) {
      if (client[key] && !sameSource(server[key], client[key])) conflicts.push(key);
      return { touch: server[key], from: "server" };
    }
    return client[key] ? { touch: client[key], from: client.legacy ? "legacy" : "client" } : { touch: null, from: null };
  };
  const first = pick("first");
  const last = pick("last");
  const lnd = pick("lastNonDirect");
  const session = pick("session");
  const lastNonDirect = lnd.touch && lnd.touch.channel !== "Direct" ? lnd.touch : null;
  const sessionTouch = session.touch || null;
  // Operational lead source: last non-direct ?? session. It is a derived copy; the individual
  // models below are stored unchanged in their own columns.
  const attributed = lastNonDirect || sessionTouch || null;
  const basisOf = attributed === lastNonDirect ? lnd.from : session.from;
  const receivedAt = now.toISOString();
  const conversionPath = (() => {
    try {
      return new URL(pageUrl).pathname;
    } catch {
      return undefined;
    }
  })();
  const conversionTouch = sessionTouch
    ? { ...sessionTouch, conversionPage: pageUrl, conversionPath, timestamp: receivedAt }
    : { channel: null, conversionPage: pageUrl, conversionPath, timestamp: receivedAt };

  // Click IDs: server-recorded (with click time) first, then the browser's records.
  const clientRecords = cleanClickIdRecords(payload.clickIds, nowMs);
  const clickIds = { ...clientRecords, ...(server.clickIds || {}) };
  const touches = [attributed, sessionTouch, last.touch, first.touch];
  const clickIdValues = flatClickIds(clickIds, touches);
  for (const [key, value] of Object.entries(clickIdValues)) {
    if (!clickIds[key]) clickIds[key] = { value };
  }

  const anyConflict = conflicts.length > 0 || touches.some((t) => t?.conflict);
  return {
    first: first.touch,
    last: last.touch,
    lastNonDirect,
    session: sessionTouch,
    conversion: conversionTouch,
    attributed,
    clickIds,
    clickIdValues,
    conflict: anyConflict,
    conflicts,
    basis: attributed ? basisOf || "client" : "none",
  };
}

const cap = (value, max) => (value ? String(value).slice(0, max) : null);

/** Lead columns (036) from a resolved attribution. Null where unknown. */
function leadAttributionColumns(result) {
  const a = result.attributed;
  const f = result.first;
  const l = result.last;
  const n = result.lastNonDirect;
  const ids = result.clickIdValues;
  return {
    channel: cap(a?.channel, 100),
    source: cap(a?.source, 100),
    medium: cap(a?.medium, 100),
    campaign: cap(a?.campaign, 255),
    content: cap(a?.content, 255),
    term: cap(a?.term, 500),
    firstTouch: f || null,
    lastTouch: l || null,
    lastNonDirectTouch: n || null,
    sessionTouch: result.session || null,
    conversionTouch: result.conversion || null,
    firstTouchSource: cap(f?.source, 100),
    firstTouchMedium: cap(f?.medium, 100),
    firstTouchChannel: cap(f?.channel, 100),
    lastTouchSource: cap(l?.source, 100),
    lastTouchMedium: cap(l?.medium, 100),
    lastTouchChannel: cap(l?.channel, 100),
    lndSource: cap(n?.source, 100),
    lndMedium: cap(n?.medium, 100),
    lndChannel: cap(n?.channel, 100),
    gclid: ids.gclid || null,
    gbraid: ids.gbraid || null,
    wbraid: ids.wbraid || null,
    dclid: ids.dclid || null,
    fbclid: ids.fbclid || null,
    msclkid: ids.msclkid || null,
    ttclid: ids.ttclid || null,
    liFatId: ids.liFatId || null,
    twclid: ids.twclid || null,
    clickIds: Object.keys(result.clickIds).length ? result.clickIds : null,
    referrerUrl: cap(a?.referrer, 2048),
    referrerDomain: cap(a?.referrerDomain, 255),
    firstLandingPage: cap(f?.landingUrl || f?.landingPage, 2048),
    sessionLandingPage: cap(result.session?.landingUrl || result.session?.landingPage, 2048),
    landingPageUrl: cap(a?.landingUrl, 2048),
    conversionPage: cap(cleanUrl(result.conversion?.conversionPage), 2048),
    rawQuery: cap(a?.rawQuery, 2048),
    attributionConflict: Boolean(result.conflict),
    attributionBasis: result.basis,
  };
}

module.exports = {
  resolveLeadAttribution,
  leadAttributionColumns,
  legacyAttributionJson,
};
