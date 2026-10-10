/**
 * One-off: add the server-renderable copy (content.ssr) to custom-html sections of pages that
 * were published before SSR copies existed. New publishes compute it automatically.
 *
 * Dry run by default. Pass --apply to write.
 *   node marketing/scripts/backfillCustomHtmlSsr.js
 *   node marketing/scripts/backfillCustomHtmlSsr.js --apply
 */
require("dotenv").config();
const { Op } = require("sequelize");
const { getLandingPageModel } = require("../models/landingPage");
const { attachCustomHtmlSsr } = require("../utils/customHtmlSsr");

const apply = process.argv.includes("--apply");

async function run() {
  const LandingPage = getLandingPageModel();
  const pages = await LandingPage.findAll({ where: { status: { [Op.in]: ["published", "scheduled"] } } });
  let affected = 0;

  for (const page of pages) {
    const before = page.publishedSections;
    if (!Array.isArray(before)) continue;
    const customCount = before.filter((s) => s && (s.renderType || s.type) === "custom-html").length;
    if (customCount === 0) continue;

    const after = attachCustomHtmlSsr(before);
    if (JSON.stringify(after) === JSON.stringify(before)) continue;
    affected += 1;
    const withSsr = after.filter((s) => s?.content?.ssr).length;
    console.log(`${apply ? "update" : "would update"} ${page.slug}: ${customCount} custom-html section(s), ${withSsr} with SSR copy`);
    if (apply) {
      page.publishedSections = after;
      await page.save();
    }
  }

  console.log(
    `${pages.length} live pages scanned, ${affected} ${apply ? "updated" : "would be updated"}.${apply ? " Revalidate or wait 5 min for the website cache." : " Re-run with --apply to write."}`,
  );
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("backfillCustomHtmlSsr failed:", error.message);
    process.exit(1);
  });
