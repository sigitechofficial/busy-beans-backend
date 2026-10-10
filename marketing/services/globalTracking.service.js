const { getGlobalTrackingSettingModel } = require("../models/globalTrackingSetting");
const { normalizeTrackingSettings, toSettingsObject } = require("../utils/trackingSettings");
const { revalidateWebsiteTracking } = require("./websiteRevalidate.service");

const DEFAULT_SETTINGS = {
  captureUtmFields: true,
};

/** The model maps the timestamp to updated_at (not updatedAt). */
function savedAt(row) {
  return row.get("updated_at") ?? row.updatedAt ?? null;
}

async function getOrCreateSettingsRow() {
  const GlobalTrackingSetting = getGlobalTrackingSettingModel();
  let row = await GlobalTrackingSetting.findByPk(1);
  if (!row) {
    row = await GlobalTrackingSetting.create({
      id: 1,
      settings: DEFAULT_SETTINGS,
      updatedBy: "System",
    });
  }
  return row;
}

async function getTrackingSettings() {
  const row = await getOrCreateSettingsRow();
  return {
    settings: { ...DEFAULT_SETTINGS, ...toSettingsObject(row.settings) },
    updatedAt: savedAt(row),
    updatedBy: row.updatedBy || "System",
  };
}

async function getDefaultTrackingForNewPage() {
  const row = await getOrCreateSettingsRow();
  return { ...DEFAULT_SETTINGS, ...toSettingsObject(row.settings) };
}

async function updateTrackingSettings(settings, actor) {
  const row = await getOrCreateSettingsRow();
  row.settings = normalizeTrackingSettings(settings || DEFAULT_SETTINGS);
  row.updatedBy = actor?.name || actor?.email || actor?.sub || "System";
  await row.save();
  revalidateWebsiteTracking();
  return {
    settings: row.settings,
    updatedAt: savedAt(row),
    updatedBy: row.updatedBy,
  };
}

/**
 * What the website loads on every page: validated tag IDs + custom scripts. Stored settings
 * that no longer validate (saved before validation existed) are dropped field by field.
 */
async function getPublicTrackingSettings() {
  const row = await getOrCreateSettingsRow();
  const stored = toSettingsObject(row.settings || DEFAULT_SETTINGS);
  const out = {};
  for (const [key, value] of Object.entries(stored)) {
    try {
      Object.assign(out, normalizeTrackingSettings({ [key]: value }));
    } catch {
      /* invalid legacy value: skip */
    }
  }
  return { ...out, captureUtmFields: stored.captureUtmFields !== false, updatedAt: savedAt(row) };
}

module.exports = {
  getPublicTrackingSettings,
  getTrackingSettings,
  getDefaultTrackingForNewPage,
  updateTrackingSettings,
};
