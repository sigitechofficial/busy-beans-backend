const { getGlobalTrackingSettingModel } = require("../models/globalTrackingSetting");

const DEFAULT_SETTINGS = {
  captureUtmFields: true,
};

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
    settings: row.settings || DEFAULT_SETTINGS,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy || "System",
  };
}

async function getDefaultTrackingForNewPage() {
  const row = await getOrCreateSettingsRow();
  return { ...(row.settings || DEFAULT_SETTINGS) };
}

async function updateTrackingSettings(settings, actor) {
  const row = await getOrCreateSettingsRow();
  row.settings = settings || DEFAULT_SETTINGS;
  row.updatedBy = actor?.name || actor?.email || actor?.sub || "System";
  await row.save();
  return {
    settings: row.settings,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

module.exports = {
  getTrackingSettings,
  getDefaultTrackingForNewPage,
  updateTrackingSettings,
};
