/**
 * Build / rebuild daily page stats (marketing_daily_page_stats) for closed business days.
 * Reports fill missing days on first read, but run this after deploy (or after changing
 * MARKETING_REPORT_TIMEZONE) so the first dashboard load is fast. Idempotent.
 *
 *   node marketing/scripts/rollupPageStats.js                       # first event day → yesterday
 *   node marketing/scripts/rollupPageStats.js --from 2026-06-01 --to 2026-06-30
 */
require("dotenv").config();
const { rollupDay, resolveDays } = require("../services/pageStats.service");
const { addDays, daysBetween, isDay } = require("../utils/businessTime");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function run() {
  const from = arg("--from");
  const to = arg("--to");
  if ((from && !isDay(from)) || (to && !isDay(to))) throw new Error("--from/--to must be YYYY-MM-DD");
  const { tz, today, fromDay, toDay } = await resolveDays({ fromDay: from, toDay: to });
  const lastClosed = toDay < today ? toDay : addDays(today, -1);
  const days = daysBetween(fromDay, lastClosed);
  let rows = 0;
  for (const day of days) {
    // eslint-disable-next-line no-await-in-loop
    rows += await rollupDay(day, tz);
  }
  // eslint-disable-next-line no-console
  console.log(`rolled up ${days.length} day(s) ${days[0] || "-"} … ${days[days.length - 1] || "-"} (${tz}), ${rows} page row(s)`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("rollupPageStats failed:", error.message);
    process.exit(1);
  });
