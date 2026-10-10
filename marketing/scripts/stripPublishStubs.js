/**
 * One-off cleanup: remove legacy custom-HTML "publish stub" sections
 * (ids starting with "sec-publish-stub-") from landing_pages draft/published sections.
 *
 * Dry run by default (prints what would change). Pass --apply to write.
 *   node marketing/scripts/stripPublishStubs.js
 *   node marketing/scripts/stripPublishStubs.js --apply
 */
require("dotenv").config();
const { getLandingPageModel } = require("../models/landingPage");
const { parseJsonField } = require("../utils/jsonField");

const STUB_PREFIX = "sec-publish-stub-";
const apply = process.argv.includes("--apply");

function stripStubs(raw) {
  const sections = parseJsonField(raw, null);
  if (!Array.isArray(sections)) return { changed: false, sections };
  const kept = sections.filter(
    (section) => !(section && typeof section.id === "string" && section.id.startsWith(STUB_PREFIX)),
  );
  return { changed: kept.length !== sections.length, sections: kept, removed: sections.length - kept.length };
}

async function run() {
  const LandingPage = getLandingPageModel();
  const pages = await LandingPage.findAll();
  let affected = 0;

  for (const page of pages) {
    const draft = stripStubs(page.draftSections);
    const published = stripStubs(page.publishedSections);
    if (!draft.changed && !published.changed) continue;

    affected += 1;
    console.log(
      `${apply ? "fix" : "would fix"} ${page.slug} (${page.status}): draft -${draft.removed || 0}, published -${published.removed || 0}`,
    );

    if (apply) {
      if (draft.changed) page.draftSections = draft.sections;
      if (published.changed) page.publishedSections = published.sections;
      await page.save();
    }
  }

  console.log(
    `${pages.length} pages scanned, ${affected} ${apply ? "updated" : "would be updated"}.${apply ? "" : " Re-run with --apply to write."}`,
  );
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("stripPublishStubs failed:", error.message);
    process.exit(1);
  });
