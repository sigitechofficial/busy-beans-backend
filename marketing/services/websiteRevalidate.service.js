/**
 * Tells the customer website to drop its cached copy of a landing page (and the landing
 * page sitemap) right after publish / unpublish / archive / delete / scheduled changes,
 * so changes appear within seconds instead of waiting for the cache to expire.
 *
 *   WEBSITE_REVALIDATE_SECRET  shared secret (must match the website's REVALIDATE_SECRET)
 *   WEBSITE_REVALIDATE_URL     optional; defaults to WEBSITE_PUBLIC_URL + /api/revalidate
 *
 * Fire-and-forget: never throws, never blocks the admin action. When not configured it does
 * nothing (the website still refreshes on its own cache interval).
 */
const { getWebsitePublicUrl } = require("../utils/publicUrls");

const TIMEOUT_MS = 4000;

function getRevalidateEndpoint() {
  const explicit = String(process.env.WEBSITE_REVALIDATE_URL || "").trim();
  if (explicit) return explicit;
  const website = getWebsitePublicUrl();
  return website ? `${website}/api/revalidate` : "";
}

function revalidateWebsiteLandingPage(slug) {
  const secret = String(process.env.WEBSITE_REVALIDATE_SECRET || "").trim();
  const endpoint = getRevalidateEndpoint();
  if (!secret || !endpoint || !slug) return;

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
    body: JSON.stringify({ slug }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
    .then((res) => {
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn(`[marketing] website revalidate for "${slug}" returned HTTP ${res.status}`);
      }
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.warn(`[marketing] website revalidate for "${slug}" failed: ${error.message}`);
    });
}

/** Tracking & Scripts saved: the website reloads its site-wide tags (fire-and-forget). */
function revalidateWebsiteTracking() {
  const secret = String(process.env.WEBSITE_REVALIDATE_SECRET || "").trim();
  const endpoint = getRevalidateEndpoint();
  if (!secret || !endpoint) return;
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
    body: JSON.stringify({ scope: "tracking" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch((error) => {
    // eslint-disable-next-line no-console
    console.warn(`[marketing] website tracking revalidate failed: ${error.message}`);
  });
}

module.exports = { revalidateWebsiteLandingPage, revalidateWebsiteTracking };
