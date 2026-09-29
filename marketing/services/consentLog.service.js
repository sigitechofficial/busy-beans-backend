/**
 * Cookie consent log (proof of consent) — see migrations/031_create_marketing_consent_log.sql.
 *
 *   recordConsent   stores one validated choice from the website banner
 *   getConsentSummary  counts per action / choice / region for the admin screen
 *   findConsentRecords  history for one consent id (the id in the visitor's bb_consent cookie)
 *   purgeOldConsent  retention (MARKETING_CONSENT_LOG_RETENTION_DAYS, default 1095 = 3 years)
 */
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { appendTimestampFilter, toSqlUtc } = require("../utils/dateRange");

const ACTIONS = new Set(["accept_all", "reject_all", "custom"]);
const MODES = new Set(["auto", "opt_in", "opt_out"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validationError(message, field) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  error.field = field;
  return error;
}

function short(value, max) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
}

/** Validates the browser payload; throws VALIDATION_ERROR. Unknown fields are ignored. */
function normalizeConsentPayload(body) {
  const src = body && typeof body === "object" ? body : {};
  if (typeof src.consentId !== "string" || !UUID.test(src.consentId)) throw validationError("Invalid consent id.", "consentId");
  if (typeof src.analytics !== "boolean") throw validationError("analytics must be true or false.", "analytics");
  if (typeof src.marketing !== "boolean") throw validationError("marketing must be true or false.", "marketing");
  if (!ACTIONS.has(src.action)) throw validationError("Invalid action.", "action");
  if (!MODES.has(src.mode)) throw validationError("Invalid consent mode.", "mode");
  const country = typeof src.country === "string" && /^[A-Za-z]{2}$/.test(src.country) ? src.country.toUpperCase() : null;
  const policyVersion = short(src.policyVersion, 20);
  if (!policyVersion || !/^[\w.-]+$/.test(policyVersion)) throw validationError("Invalid policy version.", "policyVersion");
  const bannerVersion = short(src.bannerVersion, 10);
  if (!bannerVersion || !/^[\w.-]+$/.test(bannerVersion)) throw validationError("Invalid banner version.", "bannerVersion");
  let pagePath = short(src.pagePath, 500);
  if (pagePath && !pagePath.startsWith("/")) pagePath = null;
  // A visitor id only exists (and is only sent) when analytics cookies are allowed.
  const visitorId = src.analytics ? short(src.visitorId, 64) : null;
  return {
    consentId: src.consentId.toLowerCase(),
    visitorId,
    analytics: src.analytics,
    marketing: src.marketing,
    action: src.action,
    mode: src.mode,
    optInRegion: src.optInRegion === true,
    country,
    gpc: src.gpc === true,
    policyVersion,
    bannerVersion,
    pagePath: pagePath ? pagePath.split("?")[0] : null,
  };
}

async function recordConsent(payload, meta = {}) {
  const row = normalizeConsentPayload(payload);
  await getMarketingSequelize().query(
    `INSERT INTO marketing_consent_log
       (consent_id, visitor_id, analytics, marketing, action, consent_mode, opt_in_region, country, gpc,
        policy_version, banner_version, page_path, ip_anonymized, user_agent, created_at)
     VALUES (:consentId, :visitorId, :analytics, :marketing, :action, :mode, :optInRegion, :country, :gpc,
        :policyVersion, :bannerVersion, :pagePath, :ip, :userAgent, :createdAt)`,
    {
      replacements: {
        ...row,
        analytics: row.analytics ? 1 : 0,
        marketing: row.marketing ? 1 : 0,
        optInRegion: row.optInRegion ? 1 : 0,
        gpc: row.gpc ? 1 : 0,
        ip: meta.ipAnonymized || null,
        userAgent: short(meta.userAgent, 300),
        createdAt: toSqlUtc(meta.now || new Date()),
      },
      type: QueryTypes.INSERT,
    },
  );
  return row;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

/** Choices saved in the range (all, and in "ask first" regions vs elsewhere). */
async function getConsentSummary(range) {
  const f = appendTimestampFilter(range, "c.created_at", "AND");
  const rows = await getMarketingSequelize().query(
    `SELECT c.opt_in_region AS optInRegion, c.action,
            COUNT(*) AS choices, SUM(c.analytics) AS analytics, SUM(c.marketing) AS marketing, SUM(c.gpc) AS gpc
     FROM marketing_consent_log c
     WHERE 1 = 1 ${f.sql}
     GROUP BY c.opt_in_region, c.action`,
    { replacements: f.replacements, type: QueryTypes.SELECT },
  );
  const bucket = () => ({ choices: 0, acceptAll: 0, rejectAll: 0, custom: 0, analyticsAllowed: 0, marketingAllowed: 0, gpc: 0 });
  const out = { all: bucket(), optInRegions: bucket(), otherRegions: bucket() };
  for (const r of rows) {
    for (const b of [out.all, num(r.optInRegion) ? out.optInRegions : out.otherRegions]) {
      b.choices += num(r.choices);
      b.analyticsAllowed += num(r.analytics);
      b.marketingAllowed += num(r.marketing);
      b.gpc += num(r.gpc);
      if (r.action === "accept_all") b.acceptAll += num(r.choices);
      else if (r.action === "reject_all") b.rejectAll += num(r.choices);
      else b.custom += num(r.choices);
    }
  }
  for (const b of Object.values(out)) {
    b.analyticsRate = pct(b.analyticsAllowed, b.choices);
    b.marketingRate = pct(b.marketingAllowed, b.choices);
  }
  return out;
}

/** Every saved choice for one consent id (newest first) — the proof for that browser. */
async function findConsentRecords(consentId) {
  if (typeof consentId !== "string" || !UUID.test(consentId)) throw validationError("Invalid consent id.", "consentId");
  const rows = await getMarketingSequelize().query(
    `SELECT consent_id AS consentId, analytics, marketing, action, consent_mode AS mode, opt_in_region AS optInRegion,
            country, gpc, policy_version AS policyVersion, banner_version AS bannerVersion, page_path AS pagePath,
            ip_anonymized AS ipAnonymized, user_agent AS userAgent, created_at AS createdAt
     FROM marketing_consent_log WHERE consent_id = :consentId ORDER BY created_at DESC, id DESC LIMIT 100`,
    { replacements: { consentId: consentId.toLowerCase() }, type: QueryTypes.SELECT },
  );
  return rows.map((r) => ({
    ...r,
    analytics: Boolean(num(r.analytics)),
    marketing: Boolean(num(r.marketing)),
    optInRegion: Boolean(num(r.optInRegion)),
    gpc: Boolean(num(r.gpc)),
  }));
}

function retentionDays() {
  const days = Number(process.env.MARKETING_CONSENT_LOG_RETENTION_DAYS || 1095);
  return Number.isFinite(days) && days >= 30 ? Math.floor(days) : 1095;
}

/** Deletes rows past retention, in batches. Returns the number deleted. */
async function purgeOldConsent(now = new Date()) {
  const cutoff = new Date(now.getTime() - retentionDays() * 24 * 60 * 60 * 1000);
  const [result] = await getMarketingSequelize().query(
    "DELETE FROM marketing_consent_log WHERE created_at < :cutoff LIMIT 5000",
    { replacements: { cutoff: toSqlUtc(cutoff) } },
  );
  return num(result?.affectedRows);
}

module.exports = {
  normalizeConsentPayload,
  recordConsent,
  getConsentSummary,
  findConsentRecords,
  purgeOldConsent,
  retentionDays,
};
