const { getVisitorModel } = require("../models/visitor");
const { getSessionModel } = require("../models/session");

async function upsertVisitor(visitorId, timestamp) {
  if (!visitorId) return;
  const at = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const Visitor = getVisitorModel();
  const existing = await Visitor.findByPk(visitorId);
  if (!existing) {
    await Visitor.create({
      visitorId,
      firstSeenAt: at,
      lastSeenAt: at,
    });
    return;
  }
  if (at < existing.firstSeenAt) existing.firstSeenAt = at;
  if (at > existing.lastSeenAt) existing.lastSeenAt = at;
  await existing.save();
}

async function upsertSession(payload, timestamp) {
  const sessionId = payload.sessionId;
  const visitorId = payload.visitorId;
  if (!sessionId || !visitorId) return;

  const at = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const Session = getSessionModel();
  const landingPageId =
    payload.landingPageId || payload.landing_page_id || null;
  const landingPageSlug =
    payload.landingPageSlug ||
    payload.landing_page_slug ||
    payload.landingPage ||
    null;
  const isLandingPageSession = Boolean(
    payload.isLandingPage || payload.is_landing_page_session,
  );

  const existing = await Session.findByPk(sessionId);
  if (!existing) {
    await Session.create({
      sessionId,
      visitorId,
      startedAt: at,
      endedAt: at,
      landingPageId,
      landingPageSlug,
      isLandingPageSession,
    });
    return;
  }

  if (at < existing.startedAt) existing.startedAt = at;
  if (at > existing.endedAt) existing.endedAt = at;
  if (landingPageId) existing.landingPageId = landingPageId;
  if (landingPageSlug) existing.landingPageSlug = landingPageSlug;
  if (isLandingPageSession) existing.isLandingPageSession = true;
  await existing.save();
}

async function touchIdentity(payload, timestamp) {
  const at = timestamp || new Date();
  await upsertVisitor(payload.visitorId, at);
  await upsertSession(payload, at);
}

module.exports = {
  upsertVisitor,
  upsertSession,
  touchIdentity,
};
