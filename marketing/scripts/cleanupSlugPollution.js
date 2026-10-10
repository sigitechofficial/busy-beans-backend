/**
 * One-off repair for analytics recorded before Phase 7. The old website tracker tagged CTA
 * clicks, scrolls, form starts and leads on ordinary pages with a landing-page slug
 * ("home", "products", ...), which then showed up as landing pages in the dashboard and
 * overwrote marketing_sessions.landing_page_slug.
 *
 *  1. Events with a pathname: backfill page_slug / page_type / site, and clear
 *     landing_page_slug / landing_page_id unless the event really happened on /lp/{slug}.
 *  2. Sessions: rebuild entry page, entry/last landing page, page_count and engaged_ms
 *     from the session's own (now clean) events.
 * Events without a pathname (server-side events) are left untouched.
 *
 * Dry run by default (prints counts). Idempotent. Pass --apply to write.
 *   node marketing/scripts/cleanupSlugPollution.js
 *   node marketing/scripts/cleanupSlugPollution.js --apply
 */
require("dotenv").config();
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { resolvePageContext } = require("../utils/analyticsPayload");

const apply = process.argv.includes("--apply");
const BATCH = 500;

async function repairEvents(db) {
  let lastId = "";
  let scanned = 0;
  let pollutedCleared = 0;
  let backfilled = 0;
  for (;;) {
    const rows = await db.query(
      `SELECT id, pathname, landing_page_slug AS landingPageSlug, landing_page_id AS landingPageId,
              page_slug AS pageSlug, page_type AS pageType, site, metadata
       FROM marketing_analytics_events
       WHERE pathname IS NOT NULL AND pathname != '' AND id > :lastId
       ORDER BY id LIMIT ${BATCH}`,
      { replacements: { lastId }, type: QueryTypes.SELECT },
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      scanned += 1;
      lastId = row.id;
      let metadata = row.metadata;
      if (typeof metadata === "string") {
        try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
      }
      const ctx = resolvePageContext({
        pathname: row.pathname,
        landingPageSlug: row.landingPageSlug,
        landingPageId: row.landingPageId,
        metadata: metadata || {},
      });
      const next = {
        landingPageSlug: ctx.landingPageSlug,
        landingPageId: ctx.landingPageSlug ? (row.landingPageId || null) : null,
        pageSlug: ctx.pageSlug,
        pageType: ctx.pageType,
        site: row.site || ctx.site,
      };
      const polluted = Boolean(row.landingPageSlug) && !next.landingPageSlug;
      const changed =
        polluted ||
        row.pageSlug !== next.pageSlug ||
        row.pageType !== next.pageType ||
        (row.site || null) !== (next.site || null) ||
        (row.landingPageId || null) !== next.landingPageId;
      if (!changed) continue;
      if (polluted) pollutedCleared += 1;
      else backfilled += 1;
      if (apply) {
        await db.query(
          `UPDATE marketing_analytics_events
           SET landing_page_slug = :landingPageSlug, landing_page_id = :landingPageId,
               page_slug = :pageSlug, page_type = :pageType, site = :site
           WHERE id = :id`,
          { replacements: { ...next, id: row.id } },
        );
      }
    }
  }
  return { scanned, pollutedCleared, backfilled };
}

async function repairSessions(db) {
  let lastId = "";
  let scanned = 0;
  let changedCount = 0;
  for (;;) {
    const sessions = await db.query(
      `SELECT session_id AS sessionId, entry_pathname AS entryPathname,
              entry_landing_page_slug AS entryLandingPageSlug, last_landing_page_slug AS lastLandingPageSlug,
              landing_page_slug AS landingPageSlug, is_landing_page_session AS isLandingPageSession,
              page_count AS pageCount, engaged_ms AS engagedMs
       FROM marketing_sessions WHERE session_id > :lastId ORDER BY session_id LIMIT ${BATCH}`,
      { replacements: { lastId }, type: QueryTypes.SELECT },
    );
    if (sessions.length === 0) break;
    for (const s of sessions) {
      scanned += 1;
      lastId = s.sessionId;
      const events = await db.query(
        `SELECT event_type AS eventType, pathname, landing_page_slug AS landingPageSlug,
                JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.activeMs')) AS activeMs
         FROM marketing_analytics_events WHERE session_id = :sid ORDER BY timestamp, id`,
        { replacements: { sid: s.sessionId }, type: QueryTypes.SELECT },
      );
      const tps = await db.query(
        `SELECT pathname FROM marketing_touchpoints WHERE session_id = :sid AND pathname IS NOT NULL ORDER BY timestamp, id LIMIT 1`,
        { replacements: { sid: s.sessionId }, type: QueryTypes.SELECT },
      );
      const firstWithPath = events.find((e) => e.pathname) || tps[0];
      const entryPathname = firstWithPath?.pathname || s.entryPathname || null;
      const entryMatch = entryPathname && entryPathname.match(/^\/lp\/([^/?#]+)/);
      const lpEvents = events.filter((e) => e.pathname && /^\/lp\//.test(e.pathname) && e.landingPageSlug);
      const lastLp = lpEvents.length ? lpEvents[lpEvents.length - 1].landingPageSlug : null;
      const next = {
        entryPathname,
        entryLandingPageSlug: entryMatch ? decodeURIComponent(entryMatch[1]) : null,
        lastLandingPageSlug: lastLp,
        landingPageSlug: lastLp,
        isLandingPageSession: lpEvents.length > 0 ? 1 : 0,
        pageCount: events.filter((e) => e.eventType === "page_view" || e.eventType === "landing_page_view").length,
        engagedMs: events
          .filter((e) => e.eventType === "page_engagement")
          .reduce((sum, e) => sum + Math.min(Math.max(Number(e.activeMs) || 0, 0), 30 * 60 * 1000), 0),
      };
      const changed = Object.keys(next).some((k) => String(s[k] ?? "") !== String(next[k] ?? ""));
      if (!changed) continue;
      changedCount += 1;
      if (apply) {
        await db.query(
          `UPDATE marketing_sessions
           SET entry_pathname = :entryPathname, entry_landing_page_slug = :entryLandingPageSlug,
               last_landing_page_slug = :lastLandingPageSlug, landing_page_slug = :landingPageSlug,
               is_landing_page_session = :isLandingPageSession, page_count = :pageCount, engaged_ms = :engagedMs
           WHERE session_id = :sessionId`,
          { replacements: { ...next, sessionId: s.sessionId } },
        );
      }
    }
  }
  return { scanned, changed: changedCount };
}

async function run() {
  const db = getMarketingSequelize();
  const events = await repairEvents(db);
  const sessions = await repairSessions(db);
  const verb = apply ? "" : "would be ";
  console.log(
    `events: ${events.scanned} scanned, ${events.pollutedCleared} ${verb}cleared of a wrong landing-page slug, ${events.backfilled} ${verb}backfilled with page fields`,
  );
  console.log(`sessions: ${sessions.scanned} scanned, ${sessions.changed} ${verb}rebuilt`);
  if (!apply) console.log("Dry run — re-run with --apply to write.");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("cleanupSlugPollution failed:", error.message);
    process.exit(1);
  });
