/**
 * Data migration: page_type / page_slug for leads stored before migration 040, derived from
 * page_url exactly like new leads (resolvePageContext). Idempotent: only rows still NULL.
 */
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { resolvePageContext } = require("../utils/analyticsPayload");

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

async function up() {
  const db = getMarketingSequelize();
  let updated = 0;
  let lastId = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await db.query(
      "SELECT id, page_url AS pageUrl FROM lead_submissions WHERE page_slug IS NULL AND id > :lastId ORDER BY id LIMIT 500",
      { replacements: { lastId }, type: QueryTypes.SELECT },
    );
    if (!rows.length) break;
    for (const row of rows) {
      lastId = row.id;
      const pathname = pathOf(row.pageUrl);
      if (!pathname) continue; // eslint-disable-line no-continue
      const page = resolvePageContext({ pathname });
      // eslint-disable-next-line no-await-in-loop
      await db.query("UPDATE lead_submissions SET page_type = :type, page_slug = :slug WHERE id = :id", {
        replacements: { type: page.pageType, slug: page.pageSlug, id: row.id },
      });
      updated += 1;
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[041] lead page keys backfilled: ${updated}`);
}

module.exports = { up };
