const { UniqueConstraintError } = require("sequelize");
const { getVisitorModel } = require("../models/visitor");
const { getSessionModel } = require("../models/session");
const { resolvePageContext } = require("../utils/analyticsPayload");

const PAGE_VIEW_EVENTS = new Set(["page_view", "landing_page_view"]);
/** One engagement report can't add more than 30 minutes (guards against bad clocks/clients). */
const MAX_ENGAGED_MS_PER_EVENT = 30 * 60 * 1000;

/**
 * The tracker posts a touchpoint and an event at the same moment, so the first
 * request for a new visitor/session races to insert the same primary key. The
 * loser re-reads the row and updates it instead of failing the whole ingest.
 */
async function findOrCreateByPk(Model, pk, createValues) {
  const existing = await Model.findByPk(pk);
  if (existing) return { row: existing, created: false };
  try {
    return { row: await Model.create(createValues), created: true };
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
    const row = await Model.findByPk(pk);
    if (!row) throw error;
    return { row, created: false };
  }
}

async function upsertVisitor(visitorId, timestamp) {
  if (!visitorId) return;
  const at = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const Visitor = getVisitorModel();
  const { row: existing, created } = await findOrCreateByPk(Visitor, visitorId, {
    visitorId,
    firstSeenAt: at,
    lastSeenAt: at,
  });
  if (created) return;
  if (at < existing.firstSeenAt) existing.firstSeenAt = at;
  if (at > existing.lastSeenAt) existing.lastSeenAt = at;
  await existing.save();
}

function engagedMsOf(payload, eventType) {
  if (eventType !== "page_engagement") return 0;
  const value = Number(payload?.metadata?.activeMs);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.round(value), MAX_ENGAGED_MS_PER_EVENT);
}

/**
 * Session row per visit.
 *   entry_pathname / entry_landing_page_slug  where the visit started — written once
 *   landing_page_slug / last_landing_page_slug  most recent landing page in the visit
 *   page_count / engaged_ms                   atomic increments (page views / engagement)
 * Landing-page fields come from resolvePageContext, so ordinary site pages never set them.
 */
async function upsertSession(payload, timestamp, { eventType = "", page } = {}) {
  const sessionId = payload.sessionId;
  const visitorId = payload.visitorId;
  if (!sessionId || !visitorId) return;

  const at = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const ctx = page || resolvePageContext(payload);
  const isLanding = ctx.pageType === "landing_page" && Boolean(ctx.landingPageSlug);
  const pageViews = PAGE_VIEW_EVENTS.has(eventType) ? 1 : 0;
  const engagedMs = engagedMsOf(payload, eventType);
  const Session = getSessionModel();

  const { row: existing, created } = await findOrCreateByPk(Session, sessionId, {
    sessionId,
    visitorId,
    startedAt: at,
    endedAt: at,
    landingPageId: isLanding ? ctx.landingPageId : null,
    landingPageSlug: isLanding ? ctx.landingPageSlug : null,
    isLandingPageSession: isLanding,
    entryPathname: ctx.pathname,
    entryLandingPageSlug: isLanding ? ctx.landingPageSlug : null,
    lastLandingPageSlug: isLanding ? ctx.landingPageSlug : null,
    pageCount: pageViews,
    engagedMs,
    lastActivityAt: new Date(),
  });
  if (created) return;

  if (at < existing.startedAt) existing.startedAt = at;
  if (at > existing.endedAt) existing.endedAt = at;
  existing.lastActivityAt = new Date();
  if (!existing.entryPathname && ctx.pathname) {
    existing.entryPathname = ctx.pathname;
    if (isLanding && !existing.entryLandingPageSlug) existing.entryLandingPageSlug = ctx.landingPageSlug;
  }
  if (isLanding) {
    existing.landingPageSlug = ctx.landingPageSlug;
    existing.lastLandingPageSlug = ctx.landingPageSlug;
    if (ctx.landingPageId) existing.landingPageId = ctx.landingPageId;
    existing.isLandingPageSession = true;
  }
  await existing.save();

  if (pageViews || engagedMs) {
    await Session.increment(
      { ...(pageViews ? { pageCount: pageViews } : {}), ...(engagedMs ? { engagedMs } : {}) },
      { where: { sessionId } },
    );
  }
}

/**
 * The session's acquisition touch: set once, by the session's first touchpoint (a conditional
 * UPDATE, so two concurrent touchpoints can't both win). Internal navigation never sends one.
 */
async function recordSessionTouch(sessionId, touch) {
  if (!sessionId || !touch?.channel) return;
  await getSessionModel().update(
    {
      channel: touch.channel,
      source: touch.source || null,
      medium: touch.medium || null,
      campaign: touch.campaign || null,
      content: touch.content || null,
      term: touch.term || null,
      referrer: touch.referrer || null,
      landingUrl: touch.landingUrl || null,
      touch,
    },
    { where: { sessionId, channel: null } },
  );
}

/**
 * Visitor touches (server time): first touch is write-once; every new touch is the last touch;
 * a non-direct touch also becomes the last non-direct touch (a later Direct visit never
 * overwrites it). Click IDs are merged, each with the time it was received.
 */
async function recordVisitorTouch(visitorId, touch) {
  if (!visitorId || !touch?.channel) return;
  const visitor = await getVisitorModel().findByPk(visitorId);
  if (!visitor) return;
  if (!visitor.firstTouch) {
    visitor.firstTouch = touch;
    visitor.firstTouchChannel = touch.channel;
    visitor.firstTouchSource = touch.source ? String(touch.source).slice(0, 100) : null;
  }
  visitor.lastTouch = touch;
  if (touch.channel !== "Direct") visitor.lastNonDirectTouch = touch;
  const clickIds = { ...(visitor.clickIds || {}) };
  for (const [key, value] of Object.entries(touch.clickIds || {})) {
    if (value) clickIds[key] = { value, at: touch.receivedAt || new Date().toISOString() };
  }
  visitor.clickIds = Object.keys(clickIds).length ? clickIds : null;
  visitor.changed("clickIds", true);
  await visitor.save();
}

async function touchIdentity(payload, timestamp, options = {}) {
  const at = timestamp || new Date();
  await upsertVisitor(payload.visitorId, at);
  await upsertSession(payload, at, options);
}

module.exports = {
  upsertVisitor,
  upsertSession,
  touchIdentity,
  recordSessionTouch,
  recordVisitorTouch,
};
