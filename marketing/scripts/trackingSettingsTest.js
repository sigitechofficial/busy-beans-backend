/**
 * Tracking tags & scripts contract (Phase 13). Local DB only: saves test settings through the
 * controller, checks validation, the Super Admin script guard and the public payload, then
 * restores the original settings row exactly.
 *   node marketing/scripts/trackingSettingsTest.js
 */
require("dotenv").config();
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getGlobalTrackingSettingModel } = require("../models/globalTrackingSetting");
const controller = require("../controllers/globalTracking.controller");
const { normalizeTrackingSettings, scriptsChanged, isPlaceholder, toSettingsObject } = require("../utils/trackingSettings");

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

/** Calls an Express handler with a fake req/res; resolves with { status, body, headers }. */
function call(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      headers: {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      set(name, value) {
        this.headers[name.toLowerCase()] = value;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body, headers: this.headers });
        return this;
      },
    };
    handler(req, res, (error) => (error ? reject(error) : resolve({ status: res.statusCode, body: null })));
  });
}

const VALID = {
  ga4MeasurementId: "g-ab12cd34",
  googleTagManagerId: "GTM-AB12CD",
  googleAdsId: "AW-1029384756",
  googleAdsLeadLabel: "AbC-12_x",
  metaPixelId: "918273645546372",
  linkedInInsightTagId: "5823471",
  linkedInLeadConversionId: "18273645",
  tiktokPixelId: "c9abcdef1234567890ab",
  snapchatPixelId: "0F8FAD5B-D9CB-469F-A165-70867728950E",
  xPixelId: "O1A2B",
  microsoftUetTagId: "187654321",
};

function unitChecks() {
  const out = normalizeTrackingSettings({ ...VALID, unknownKey: "<script>", captureUtmFields: false });
  assert(out.ga4MeasurementId === "G-AB12CD34", "GA4 id upper-cased");
  assert(out.tiktokPixelId === "C9ABCDEF1234567890AB", "TikTok id upper-cased");
  assert(out.snapchatPixelId === "0f8fad5b-d9cb-469f-a165-70867728950e", "Snapchat id lower-cased");
  assert(out.xPixelId === "o1a2b", "X id lower-cased");
  assert(!("unknownKey" in out), "Unknown keys dropped");
  assert(out.captureUtmFields === false, "captureUtmFields kept");

  // Placeholders clear the field (never load someone else's / nobody's pixel).
  for (const [field, value] of [
    ["ga4MeasurementId", "G-XXXXXXXX"],
    ["googleTagManagerId", "GTM-XXXXXX"],
    ["metaPixelId", "123456789"],
    ["metaPixelId", "1111111"],
    ["microsoftUetTagId", "000000"],
  ]) {
    assert(isPlaceholder(value), `${value} is a placeholder`);
    assert(!(field in normalizeTrackingSettings({ [field]: value })), `${field}=${value} dropped`);
  }
  assert(!("metaPixelId" in normalizeTrackingSettings({ metaPixelId: "  " })), "Empty clears the field");

  // Wrong formats are rejected with the field name (the ID is inserted into a tag snippet).
  assert(throwsField(() => normalizeTrackingSettings({ metaPixelId: "12345');alert(1)//" }), "metaPixelId"), "Meta id injection rejected");
  assert(throwsField(() => normalizeTrackingSettings({ ga4MeasurementId: "UA-12345-1" }), "ga4MeasurementId"), "UA id rejected");
  assert(throwsField(() => normalizeTrackingSettings({ googleTagManagerId: "GTM-AB\"><x" }), "googleTagManagerId"), "GTM id rejected");
  assert(throwsField(() => normalizeTrackingSettings({ snapchatPixelId: "not-a-uuid" }), "snapchatPixelId"), "Snap id rejected");
  assert(throwsField(() => normalizeTrackingSettings({ headerScript: "x".repeat(20001) }), "headerScript"), "Long script rejected");

  // A JSON string spread into a char map by an old bug is repaired.
  const text = JSON.stringify({ metaPixelId: VALID.metaPixelId, headerScript: "<!-- hi -->" });
  const charMap = Object.fromEntries([...text].map((c, i) => [String(i), c]));
  const repaired = normalizeTrackingSettings(charMap);
  assert(repaired.metaPixelId === VALID.metaPixelId && repaired.headerScript === "<!-- hi -->", "Char map repaired");
  assert(Object.keys(normalizeTrackingSettings('{"metaPixelId":"918273645546372"}')).includes("metaPixelId"), "JSON string accepted");
  const tripleEncoded = JSON.stringify(JSON.stringify(JSON.stringify({ metaPixelId: VALID.metaPixelId })));
  assert(normalizeTrackingSettings(tripleEncoded).metaPixelId === VALID.metaPixelId, "Repeatedly encoded JSON unwrapped");

  // Cookie consent + X conversion events.
  const consent = normalizeTrackingSettings({ consentMode: "opt_in", consentModeAdvanced: true, xLeadEventId: "TW-O1A2B-C3D4E" });
  assert(consent.consentMode === "opt_in" && consent.consentModeAdvanced === true, "Consent settings kept");
  assert(consent.xLeadEventId === "tw-o1a2b-c3d4e", "X event id lower-cased");
  assert(!("consentModeAdvanced" in normalizeTrackingSettings({ consentModeAdvanced: "yes" })), "Advanced only when true");
  assert(throwsField(() => normalizeTrackingSettings({ consentMode: "never" }), "consentMode"), "Unknown consent mode rejected");
  assert(throwsField(() => normalizeTrackingSettings({ xPurchaseEventId: "tw-1');x" }), "xPurchaseEventId"), "Bad X event id rejected");

  assert(scriptsChanged({ headerScript: " a " }, { headerScript: "a" }) === false, "Whitespace is not a script change");
  assert(scriptsChanged({}, { footerScript: "<script></script>" }) === true, "New script is a change");
}

async function controllerChecks() {
  const Model = getGlobalTrackingSettingModel();
  const db = getMarketingSequelize();
  // Raw JSON text: saving the model's value back would JSON-encode a string row once more.
  const [row] = await db.query("SELECT CAST(settings AS CHAR) AS text, updated_by AS updatedBy FROM global_tracking_settings WHERE id = 1", {
    type: QueryTypes.SELECT,
  });
  const snapshot = row ? { text: row.text, updatedBy: row.updatedBy, settings: toSettingsObject(row.text) } : null;
  const editor = { marketingUser: { sub: "tracking-test", role: "Editor", email: "editor@test.local" } };
  const superAdmin = { marketingUser: { sub: "tracking-test", role: "Super Admin", email: "sa@test.local" } };
  const currentScripts = (s) => {
    const src = s && typeof s === "object" ? s : {};
    return { headerScript: src.headerScript, bodyScript: src.bodyScript, footerScript: src.footerScript };
  };

  try {
    const before = snapshot ? currentScripts(snapshot.settings) : {};

    // Editor: tag IDs yes (scripts untouched), scripts no.
    const ok = await call(controller.updateSettings, { ...editor, body: { settings: { ...before, ...VALID } } });
    assert(ok.status === 200, `Editor may save tag IDs (got ${ok.status} ${JSON.stringify(ok.body)})`);
    const blocked = await call(controller.updateSettings, {
      ...editor,
      body: { settings: { ...before, ...VALID, headerScript: "<script>alert(1)</script>" } },
    });
    assert(blocked.status === 403 && blocked.body?.code === "SCRIPTS_FORBIDDEN", `Editor script change must be 403 (got ${blocked.status})`);

    const invalid = await call(controller.updateSettings, { ...superAdmin, body: { settings: { metaPixelId: "abc" } } });
    assert(invalid.status === 400, `Invalid ID must be 400 (got ${invalid.status})`);
    assert(JSON.stringify(invalid.body).includes("metaPixelId"), "400 must name the field");

    const saScripts = await call(controller.updateSettings, {
      ...superAdmin,
      body: { settings: { ...VALID, footerScript: "<!-- sa footer -->" } },
    });
    assert(saScripts.status === 200, `Super Admin may change scripts (got ${saScripts.status})`);

    // Public payload: validated IDs + scripts, no audit fields, cacheable.
    await Model.update(
      { settings: { ...VALID, ga4MeasurementId: "G-XXXXXXXX", metaPixelId: "bad id", footerScript: "<!-- sa footer -->" } },
      { where: { id: 1 } },
    );
    const pub = await call(controller.getPublicSettings, {});
    const data = pub.body?.data ?? pub.body;
    assert(pub.status === 200 && /max-age=60/.test(pub.headers["cache-control"] || ""), "Public settings cacheable");
    assert(!("ga4MeasurementId" in data), "Public drops placeholder GA4");
    assert(!("metaPixelId" in data), "Public drops invalid legacy Meta id");
    assert(data.tiktokPixelId === "C9ABCDEF1234567890AB" && data.footerScript === "<!-- sa footer -->", `Public keeps valid tags + scripts: ${JSON.stringify(data)}`);
    assert(!("updatedBy" in data), "Public hides updatedBy");
  } finally {
    if (snapshot) {
      await db.query("UPDATE global_tracking_settings SET settings = CAST(? AS JSON), updated_by = ? WHERE id = 1", {
        replacements: [snapshot.text, snapshot.updatedBy],
      });
      const [after] = await db.query("SELECT CAST(settings AS CHAR) AS text FROM global_tracking_settings WHERE id = 1", {
        type: QueryTypes.SELECT,
      });
      // Same JSON value (MySQL may re-format the text of a value first written by the ORM).
      assert(
        JSON.stringify(toSettingsObject(after.text)) === JSON.stringify(toSettingsObject(snapshot.text)) &&
          typeof JSON.parse(after.text) === typeof JSON.parse(snapshot.text),
        "Settings row must be restored exactly",
      );
    } else await Model.destroy({ where: { id: 1 } });
  }
}

async function run() {
  unitChecks();
  await controllerChecks();
  // eslint-disable-next-line no-console
  console.log("[tracking-settings] passed");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[tracking-settings] failed:", error.message);
    process.exit(1);
  });
