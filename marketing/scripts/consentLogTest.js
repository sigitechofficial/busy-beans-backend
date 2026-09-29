/**
 * Cookie consent log contract. Local DB only: writes rows with random consent ids and removes them.
 *   node marketing/scripts/consentLogTest.js
 * Optional: MARKETING_TEST_BASE_URL=http://localhost:8013 also checks the public endpoint
 * (valid → 204 stored, bot → 204 not stored, invalid → 400).
 */
require("dotenv").config();
const crypto = require("crypto");
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const consentLog = require("../services/consentLog.service");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function throwsField(fn, field) {
  try {
    fn();
  } catch (error) {
    return error.code === "VALIDATION_ERROR" && error.field === field;
  }
  return false;
}

const base = (over = {}) => ({
  consentId: crypto.randomUUID(),
  analytics: true,
  marketing: false,
  action: "custom",
  mode: "auto",
  optInRegion: true,
  country: "de",
  gpc: false,
  policyVersion: "2026-09-29",
  bannerVersion: "1",
  pagePath: "/lp/test-page?utm_source=x",
  visitorId: "visitor-abc",
  ...over,
});

async function run() {
  const db = getMarketingSequelize();
  const ids = [];
  try {
    // Validation
    assert(throwsField(() => consentLog.normalizeConsentPayload(base({ consentId: "nope" })), "consentId"), "bad id rejected");
    assert(throwsField(() => consentLog.normalizeConsentPayload(base({ action: "maybe" })), "action"), "bad action rejected");
    assert(throwsField(() => consentLog.normalizeConsentPayload(base({ analytics: "yes" })), "analytics"), "non-boolean rejected");
    assert(throwsField(() => consentLog.normalizeConsentPayload(base({ mode: "x" })), "mode"), "bad mode rejected");
    assert(throwsField(() => consentLog.normalizeConsentPayload(base({ policyVersion: "<x>" })), "policyVersion"), "bad policy version rejected");
    const n = consentLog.normalizeConsentPayload(base({ analytics: false }));
    assert(n.visitorId === null, "no visitor id stored without analytics consent");
    assert(n.pagePath === "/lp/test-page" && n.country === "DE", "query string dropped, country upper-cased");
    assert(consentLog.normalizeConsentPayload(base({ pagePath: "https://evil.test/x" })).pagePath === null, "absolute URL not stored");

    // Record + lookup (history for one browser)
    const a = base({ action: "accept_all", analytics: true, marketing: true });
    ids.push(a.consentId);
    await consentLog.recordConsent(a, { ipAnonymized: "203.0.113.0", userAgent: "Mozilla/5.0 test", now: new Date(Date.now() - 60_000) });
    await consentLog.recordConsent({ ...a, action: "custom", marketing: false }, { ipAnonymized: "203.0.113.0", userAgent: "Mozilla/5.0 test" });
    const history = await consentLog.findConsentRecords(a.consentId.toUpperCase());
    assert(history.length === 2, `two records for the consent id (got ${history.length})`);
    assert(history[0].action === "custom" && history[0].marketing === false, "newest first: marketing withdrawn");
    assert(history[1].action === "accept_all" && history[1].marketing === true, "original acceptance kept");
    assert(history[0].ipAnonymized === "203.0.113.0" && history[0].country === "DE", "anonymized IP + country stored");

    // Summary for today
    const other = base({ action: "reject_all", analytics: false, marketing: false, optInRegion: false, gpc: true, country: "US" });
    ids.push(other.consentId);
    await consentLog.recordConsent(other, {});
    const today = new Date();
    const summary = await consentLog.getConsentSummary({ start: new Date(today.getTime() - 3600_000), end: new Date(today.getTime() + 3600_000) });
    assert(summary.all.choices >= 3 && summary.all.acceptAll >= 1 && summary.all.rejectAll >= 1 && summary.all.custom >= 1, "summary counts actions");
    assert(summary.optInRegions.choices >= 2 && summary.otherRegions.gpc >= 1, "summary splits regions and counts GPC");

    // Retention
    const [old] = await db.query("SELECT COUNT(*) AS c FROM marketing_consent_log WHERE consent_id IN (:ids)", {
      replacements: { ids },
      type: QueryTypes.SELECT,
    });
    assert(Number(old.c) === 3, "three test rows stored");
    const purged = await consentLog.purgeOldConsent(new Date(Date.now() + (consentLog.retentionDays() + 1) * 86400_000));
    assert(purged >= 3, `purge past retention deletes rows (deleted ${purged})`);

    const baseUrl = process.env.MARKETING_TEST_BASE_URL;
    if (baseUrl) {
      const post = (body, ua) =>
        fetch(`${baseUrl.replace(/\/+$/, "")}/api/public/tracking/consent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": ua },
          body: JSON.stringify(body),
        });
      const human = base();
      const bot = base();
      ids.push(human.consentId, bot.consentId);
      const ok = await post(human, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140 Safari/537.36");
      assert(ok.status === 204, `valid consent → 204 (got ${ok.status})`);
      const botRes = await post(bot, "Googlebot/2.1");
      assert(botRes.status === 204, "bot → 204");
      const bad = await post({ ...base(), action: "hack" }, "Mozilla/5.0 Chrome/140");
      assert(bad.status === 400, `invalid → 400 (got ${bad.status})`);
      const stored = await consentLog.findConsentRecords(human.consentId);
      const botStored = await consentLog.findConsentRecords(bot.consentId);
      const ip = stored[0]?.ipAnonymized;
      assert(stored.length === 1 && ip && !["::1", "127.0.0.1"].includes(ip) && (ip.endsWith(".0") || ip.endsWith("::")), `stored with anonymized IP (${ip})`);
      assert(botStored.length === 0, "bot choice not stored");
    }
  } finally {
    if (ids.length) {
      await db.query("DELETE FROM marketing_consent_log WHERE consent_id IN (:ids)", { replacements: { ids } });
    }
  }
  // eslint-disable-next-line no-console
  console.log("[consent-log] passed");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[consent-log] failed:", error.message);
    process.exit(1);
  });
