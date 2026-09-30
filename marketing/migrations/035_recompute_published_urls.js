/**
 * Data migration: recompute the stored public address of every page that has been published
 * from WEBSITE_PUBLIC_URL (address = website origin + /lp/{slug}). Pages published while the
 * server had an old or malformed site URL (e.g. a quoted PUBLIC_SITE_URL) kept that address.
 * Runs once per environment on deploy; set WEBSITE_PUBLIC_URL in the server .env first.
 * Without it nothing is changed (re-publishing a page then fixes its address).
 */
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getWebsitePublicUrl } = require("../utils/publicUrls");

async function up() {
  const base = getWebsitePublicUrl();
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(base || "")) {
    // eslint-disable-next-line no-console
    console.warn("[035] WEBSITE_PUBLIC_URL is not a plain URL; published page addresses left unchanged.");
    return;
  }
  const db = getMarketingSequelize();
  const [{ n }] = await db.query(
    "SELECT COUNT(*) AS n FROM landing_pages WHERE published_url IS NOT NULL AND published_url <> CONCAT(:base, '/lp/', slug)",
    { replacements: { base }, type: QueryTypes.SELECT },
  );
  await db.query(
    "UPDATE landing_pages SET published_url = CONCAT(:base, '/lp/', slug) WHERE published_url IS NOT NULL AND published_url <> CONCAT(:base, '/lp/', slug)",
    { replacements: { base } },
  );
  // eslint-disable-next-line no-console
  console.log(`[035] published page addresses recomputed: ${n} (base ${base})`);
}

module.exports = { up };
