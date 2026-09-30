/**
 * Data migration: analytics recorded before migration 024 get their page fields, so page
 * reports show those visits (pages had leads but 0 visitors). Runs once per environment via
 * `npm run marketing:migrate` (the deploy runs it). Idempotent: only rows the live code never
 * filled are touched. Same steps as the manual scripts:
 *   1. marketing/scripts/backfillPageFields.js: event page fields, session entry page / page
 *      count / engaged time, removal of analytics contract-test data
 *   2. marketing/scripts/backfillProductAnalytics.js: product ids on old product views, old
 *      website views of missing pages marked not_found, order items (no customer links)
 *   3. daily page stats rebuilt
 */
const pageFields = require("../scripts/backfillPageFields");
const productAnalytics = require("../scripts/backfillProductAnalytics");

async function up() {
  await pageFields.run({ apply: true, rebuild: false });
  await productAnalytics.run({ apply: true, withCustomers: false });
  const stats = await pageFields.rebuildDailyStats();
  // eslint-disable-next-line no-console
  console.log("[034] daily page stats rebuilt:", JSON.stringify(stats));
}

module.exports = { up };
