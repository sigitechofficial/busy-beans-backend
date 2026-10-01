/**
 * Test mode is decided by the server, never by the browser (spec Phase 3).
 *
 * A lead is a TEST lead when it comes from Campaign Builder staff context:
 *   1. the request carries a valid Campaign Builder JWT (scope "marketing"): the canvas and
 *      logged-in previews send it through the Campaign Builder http client, or
 *   2. the body carries a preview token that matches the landing page's preview_token
 *      (shared /preview/landing-page/{id}?token=… links).
 * A production visitor cannot set it: `testMode` in the body is ignored.
 */
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { getMarketingJwtSecret } = require("./auth.service");
const { getLandingPageModel } = require("../models/landingPage");

function hasMarketingSession(authorization) {
  const header = String(authorization || "");
  if (!header.startsWith("Bearer ")) return false;
  const secret = getMarketingJwtSecret();
  if (!secret) return false;
  try {
    const decoded = jwt.verify(header.slice(7).trim(), secret);
    return decoded?.scope === "marketing";
  } catch {
    return false;
  }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function hasValidPreviewToken(previewToken, { landingPageId, landingPageSlug }) {
  const token = typeof previewToken === "string" ? previewToken.trim().slice(0, 200) : "";
  if (!token || (!landingPageId && !landingPageSlug)) return false;
  const LandingPage = getLandingPageModel();
  const page = landingPageId
    ? await LandingPage.findByPk(landingPageId)
    : await LandingPage.findOne({ where: { slug: landingPageSlug } });
  return Boolean(page?.previewToken) && safeEqual(page.previewToken, token);
}

/** @returns {Promise<{ testMode: boolean, reason: string | null }>} */
async function decideLeadTestMode({ authorization, previewToken, landingPageId, landingPageSlug }) {
  if (hasMarketingSession(authorization)) return { testMode: true, reason: "campaign_builder_session" };
  if (await hasValidPreviewToken(previewToken, { landingPageId, landingPageSlug })) {
    return { testMode: true, reason: "preview_token" };
  }
  return { testMode: false, reason: null };
}

module.exports = { decideLeadTestMode, hasMarketingSession };
