/**
 * Safe server-side seed bootstrap (no frontend payloads).
 * Full UI seed still runs from page-builder via module APIs.
 *
 * Usage: npm run marketing:seed-all
 */
require("dotenv").config();
const { getGlobalTrackingSettingModel } = require("../models/globalTrackingSetting");
const { seedProducts } = require("./products.seed");
const seedStatusService = require("../services/seedStatus.service");

const TRACKING_DEFAULTS = {
  ga4MeasurementId: "",
  googleTagManagerId: "",
  metaPixelId: "",
  linkedInInsightTagId: "",
  headerScript: "",
  bodyScript: "",
  footerScript: "",
  captureUtmFields: true,
};

async function seedTracking() {
  const Model = getGlobalTrackingSettingModel();
  let row = await Model.findByPk(1);
  if (!row) {
    row = await Model.create({
      id: 1,
      settings: TRACKING_DEFAULTS,
      updatedBy: "seed-all",
    });
  } else {
    row.settings = { ...TRACKING_DEFAULTS, ...(row.settings || {}) };
    row.updatedBy = "seed-all";
    await row.save();
  }
  // eslint-disable-next-line no-console
  console.log("[seed-all] tracking settings ready");
}

async function run() {
  await seedTracking();
  await seedProducts();

  const status = await seedStatusService.getSeedStatus();
  // eslint-disable-next-line no-console
  console.log("[seed-all] status snapshot:", JSON.stringify(status.modules, null, 2));
  // eslint-disable-next-line no-console
  console.log(
    "[seed-all] complete — use admin Seed Data UI for media, sections, templates, pages, campaigns",
  );
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[seed-all] failed:", error.message);
      process.exit(1);
    });
}

module.exports = { run };
