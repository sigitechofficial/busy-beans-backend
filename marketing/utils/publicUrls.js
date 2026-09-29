/**
 * Public URLs used by the marketing module. Each has ONE job:
 *
 *   WEBSITE_PUBLIC_URL  customer website origin — live /lp/{slug} links, canonical, sitemap
 *                       (local: http://localhost:3001, prod: https://www.busybeancoffee.com)
 *   CAMPAIGN_APP_URL    Campaign Builder app origin — token preview links /preview/landing-page/...
 *                       (local: http://localhost:3000)
 *   API_PUBLIC_URL      this API's public origin (no /api) — lead-submit endpoint + media file URLs
 *                       (local: http://localhost:8013, prod: https://backendbb.trimworldwide.com)
 *
 * PUBLIC_SITE_URL used to serve all of these at once, which cannot be correct for all
 * of them. It is still honored as a fallback so existing deployments keep working, with
 * a one-time warning naming the key that should be set instead.
 */
const warned = new Set();

function clean(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function fromEnvOrLegacy(key) {
  const direct = clean(process.env[key]);
  if (direct) return direct;
  const legacy = clean(process.env.PUBLIC_SITE_URL);
  if (legacy && !warned.has(key)) {
    warned.add(key);
    // eslint-disable-next-line no-console
    console.warn(
      `[marketing] ${key} is not set; falling back to deprecated PUBLIC_SITE_URL (${legacy}). Set ${key} explicitly.`,
    );
  }
  return legacy;
}

function getWebsitePublicUrl() {
  return fromEnvOrLegacy("WEBSITE_PUBLIC_URL");
}

function getCampaignAppUrl() {
  return fromEnvOrLegacy("CAMPAIGN_APP_URL");
}

function getApiPublicUrl() {
  return fromEnvOrLegacy("API_PUBLIC_URL");
}

/** Absolute lead-submit endpoint injected into published lead-form sections (or null). */
function getLeadSubmitUrl() {
  const configured = clean(process.env.DEFAULT_LEAD_SUBMIT_URL);
  if (configured) return configured;
  const api = getApiPublicUrl();
  return api ? `${api}/api/public/lead-submissions` : null;
}

module.exports = {
  getWebsitePublicUrl,
  getCampaignAppUrl,
  getApiPublicUrl,
  getLeadSubmitUrl,
};
