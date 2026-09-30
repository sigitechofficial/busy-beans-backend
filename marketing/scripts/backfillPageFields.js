/**
 * One-off backfill for analytics recorded before migration 024 (page reports):
 *   1. marketing_analytics_events: page_type / page_slug / site / pathname, derived from the
 *      event's own pathname or page URL exactly like live ingestion (resolvePageContext).
 *      Events without a page (server-side order events) are left alone.
 *   2. marketing_sessions: entry_pathname, entry/last landing page, page_count, engaged_ms,
 *      rebuilt from the session's events like live tracking (visitors.service upsertSession):
 *      entry = first event with a page, page_count = page views, engaged_ms = engagement time.
 *      Only sessions the live code never filled are touched.
 *   3. Removes data written by the automated analytics contract test (slug
 *      "contract-test-slug", visitors "contract-visitor-*") if it reached this database.
 *   4. Rebuilds the daily page stats from the first event day to yesterday.
 *
 * Dry run by default (counts only). Run the product backfill afterwards: it marks old website
 * views of missing pages as not_found.
 *   node marketing/scripts/backfillPageFields.js [--apply]
 *   node marketing/scripts/backfillProductAnalytics.js --apply
 */
require("dotenv").config();
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { resolvePageContext } = require("../utils/analyticsPayload");
const { reportTimeZone, localDateOf, addDays } = require("../utils/businessTime");
const { rollupDay } = require("../services/pageStats.service");

const APPLY = process.argv.includes("--apply");
const BATCH = 500;
const VIEW_TYPES = new Set(["page_view", "landing_page_view"]);
const MAX_ENGAGED_MS_PER_EVENT = 30 * 60 * 1000;
const CONTRACT_SLUG = "contract-test-slug";
const CONTRACT_VISITORS = "contract-visitor-%";

const db = getMarketingSequelize();
const select = (sql, replacements = {}) => db.query(sql, { replacements, type: QueryTypes.SELECT });
const exec = (sql, replacements = {}) => db.query(sql, { replacements });

function pathOf(row) {
  const direct = String(row.pathname || "").trim();
  if (direct) return direct;
  try {
    return new URL(String(row.pageUrl || "")).pathname || "";
  } catch {
    return "";
  }
}

async function backfillEvents() {
  let lastId = "";
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await select(
      `SELECT id, pathname, page_url AS pageUrl, landing_page_id AS landingPageId,
              site, JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.site')) AS metaSite
       FROM marketing_analytics_events
       WHERE page_type IS NULL AND page_slug IS NULL AND id > :lastId
       ORDER BY id LIMIT ${BATCH}`,
      { lastId },
    );
    if (!rows.length) break;
    lastId = rows[rows.length - 1].id;
    scanned += rows.length;
    for (const row of rows) {
      const pathname = pathOf(row);
      if (!pathname) {
        skipped += 1;
        continue;
      }
      const ctx = resolvePageContext({
        pathname,
        landingPageId: row.landingPageId || undefined,
        site: row.site || row.metaSite || undefined,
      });
      updated += 1;
      if (!APPLY) continue;
      // eslint-disable-next-line no-await-in-loop
      await exec(
        `UPDATE marketing_analytics_events
         SET page_type = :pageType, page_slug = :pageSlug,
             site = COALESCE(site, :site), pathname = COALESCE(pathname, :pathname)
         WHERE id = :id AND page_type IS NULL`,
        { id: row.id, pageType: ctx.pageType, pageSlug: ctx.pageSlug, site: ctx.site, pathname },
      );
    }
  }
  return { scanned, updated, skipped };
}

async function backfillSessions() {
  const sessions = await select(
    `SELECT session_id AS sessionId FROM marketing_sessions
     WHERE entry_pathname IS NULL AND page_count = 0 AND engaged_ms = 0`,
  );
  let updated = 0;
  for (let i = 0; i < sessions.length; i += BATCH) {
    const ids = sessions.slice(i, i + BATCH).map((s) => s.sessionId);
    // eslint-disable-next-line no-await-in-loop
    const events = await select(
      `SELECT session_id AS sessionId, event_type AS type, pathname, page_url AS pageUrl,
              JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.activeMs')) AS activeMs
       FROM marketing_analytics_events
       WHERE session_id IN (:ids)
       ORDER BY session_id, timestamp, id`,
      { ids },
    );
    const bySession = new Map();
    for (const e of events) {
      if (!bySession.has(e.sessionId)) bySession.set(e.sessionId, []);
      bySession.get(e.sessionId).push(e);
    }
    for (const [sessionId, list] of bySession) {
      let entryPathname = null;
      let entryLanding = null;
      let lastLanding = null;
      let pageCount = 0;
      let engagedMs = 0;
      for (const e of list) {
        if (VIEW_TYPES.has(e.type)) pageCount += 1;
        if (e.type === "page_engagement") {
          const ms = Number(e.activeMs);
          if (Number.isFinite(ms) && ms > 0) engagedMs += Math.min(Math.round(ms), MAX_ENGAGED_MS_PER_EVENT);
        }
        const pathname = pathOf(e);
        if (!pathname) continue;
        const ctx = resolvePageContext({ pathname });
        const landing = ctx.pageType === "landing_page" ? ctx.landingPageSlug : null;
        if (!entryPathname) {
          entryPathname = pathname;
          entryLanding = landing;
        }
        if (landing) lastLanding = landing;
      }
      if (!entryPathname && !engagedMs && !pageCount) continue;
      updated += 1;
      if (!APPLY) continue;
      // eslint-disable-next-line no-await-in-loop
      await exec(
        `UPDATE marketing_sessions
         SET entry_pathname = :entryPathname, entry_landing_page_slug = :entryLanding,
             last_landing_page_slug = COALESCE(last_landing_page_slug, :lastLanding),
             page_count = :pageCount, engaged_ms = :engagedMs
         WHERE session_id = :sessionId AND entry_pathname IS NULL AND page_count = 0`,
        { sessionId, entryPathname, entryLanding, lastLanding, pageCount, engagedMs },
      );
    }
  }
  return { candidates: sessions.length, updated };
}

async function removeContractTestData() {
  const counts = {};
  const targets = [
    ["leads", "lead_submissions", "landing_page_slug = :slug OR visitor_id LIKE :visitors"],
    ["events", "marketing_analytics_events", "visitor_id LIKE :visitors"],
    ["touchpoints", "marketing_touchpoints", "visitor_id LIKE :visitors"],
    ["sessions", "marketing_sessions", "visitor_id LIKE :visitors"],
    ["visitors", "marketing_visitors", "visitor_id LIKE :visitors"],
  ];
  const replacements = { slug: CONTRACT_SLUG, visitors: CONTRACT_VISITORS };
  for (const [label, table, where] of targets) {
    // eslint-disable-next-line no-await-in-loop
    const [row] = await select(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, replacements);
    counts[label] = Number(row.n);
    // eslint-disable-next-line no-await-in-loop
    if (APPLY && counts[label]) await exec(`DELETE FROM ${table} WHERE ${where}`, replacements);
  }
  return counts;
}

async function rebuildDailyStats() {
  const tz = reportTimeZone();
  const [row] = await select("SELECT MIN(timestamp) AS ts FROM marketing_analytics_events");
  if (!row?.ts) return { days: 0 };
  const today = localDateOf(new Date(), tz);
  const days = [];
  for (let day = localDateOf(new Date(row.ts), tz); day < today; day = addDays(day, 1)) days.push(day);
  if (!APPLY) return { days: days.length };
  await exec("DELETE FROM marketing_daily_page_stats");
  await exec("DELETE FROM marketing_daily_rollup_runs");
  for (const day of days) {
    // eslint-disable-next-line no-await-in-loop
    await rollupDay(day, tz);
  }
  return { days: days.length };
}

async function run() {
  console.log(`[backfill-page-fields] ${APPLY ? "APPLY" : "DRY RUN (add --apply to write)"}`);
  const contract = await removeContractTestData();
  console.log("contract-test data", APPLY ? "removed:" : "to remove:", JSON.stringify(contract));
  const events = await backfillEvents();
  console.log("events:", JSON.stringify(events));
  const sessions = await backfillSessions();
  console.log("sessions:", JSON.stringify(sessions));
  const stats = await rebuildDailyStats();
  console.log("daily page stats", APPLY ? "rebuilt:" : "to rebuild:", JSON.stringify(stats));
  if (APPLY) console.log("Next: node marketing/scripts/backfillProductAnalytics.js --apply");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[backfill-page-fields] failed:", error.message);
    process.exit(1);
  });
