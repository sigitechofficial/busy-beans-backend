const { Op } = require("sequelize");
const { getLandingPageModel } = require("../models/landingPage");
const { getLandingPageVersionModel } = require("../models/landingPageVersion");
const { injectLeadSubmitUrls } = require("../services/landingPages.service");

let intervalRef = null;
let running = false;

async function getNextVersionNumber(landingPageId) {
  const LandingPageVersion = getLandingPageVersionModel();
  const latest = await LandingPageVersion.findOne({
    where: { landingPageId },
    order: [["version_number", "DESC"]],
  });
  return latest ? latest.versionNumber + 1 : 1;
}

async function createVersion(landingPageId, action, sectionsSnapshot) {
  const LandingPageVersion = getLandingPageVersionModel();
  const versionNumber = await getNextVersionNumber(landingPageId);
  await LandingPageVersion.create({
    landingPageId,
    versionNumber,
    action,
    publishedBy: "Scheduler",
    publishedAt: new Date(),
    notes: `Auto ${action} by scheduler`,
    snapshotSectionCount: Array.isArray(sectionsSnapshot) ? sectionsSnapshot.length : 0,
    sectionsSnapshot: sectionsSnapshot || null,
  });
}

async function runScheduledPublishCycle() {
  const LandingPage = getLandingPageModel();
  const now = new Date();
  const pages = await LandingPage.findAll({
    where: {
      status: "scheduled",
      scheduledAt: { [Op.lte]: now },
    },
  });

  for (const page of pages) {
    // eslint-disable-next-line no-await-in-loop
    await page.update({
      status: "published",
      publishedSections: injectLeadSubmitUrls(
        JSON.parse(JSON.stringify(page.draftSections || [])),
      ),
      publishedAt: now,
      updatedBy: "scheduler",
    });
    // eslint-disable-next-line no-await-in-loop
    await createVersion(page.id, "published", page.draftSections || []);
  }

  return pages.length;
}

async function runScheduledUnpublishCycle() {
  const LandingPage = getLandingPageModel();
  const now = new Date();
  const pages = await LandingPage.findAll({
    where: {
      status: { [Op.in]: ["published", "scheduled"] },
      unpublishAt: { [Op.ne]: null, [Op.lte]: now },
    },
  });

  for (const page of pages) {
    // eslint-disable-next-line no-await-in-loop
    await page.update({
      status: "draft",
      publishedAt: null,
      scheduledAt: null,
      unpublishAt: null,
      updatedBy: "scheduler",
    });
    // eslint-disable-next-line no-await-in-loop
    await createVersion(page.id, "unpublished", page.draftSections || []);
  }

  return pages.length;
}

async function runLandingPageSchedulerCycle() {
  if (running) return { skipped: true };
  running = true;
  try {
    const published = await runScheduledPublishCycle();
    const unpublished = await runScheduledUnpublishCycle();
    return { skipped: false, published, unpublished };
  } finally {
    running = false;
  }
}

function startLandingPageScheduler() {
  if (intervalRef) return intervalRef;
  const enabled = process.env.MARKETING_SCHEDULER_ENABLED !== "false";
  if (!enabled) return null;

  const intervalMs = Number(process.env.MARKETING_SCHEDULER_INTERVAL_MS || 60_000);
  intervalRef = setInterval(async () => {
    try {
      const result = await runLandingPageSchedulerCycle();
      if (!result?.skipped && (result.published > 0 || result.unpublished > 0)) {
        // eslint-disable-next-line no-console
        console.log(
          `[marketing:scheduler] published=${result.published} unpublished=${result.unpublished}`,
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[marketing:scheduler] cycle failed:", error.message);
    }
  }, intervalMs);

  // eslint-disable-next-line no-console
  console.log(`[marketing:scheduler] started, interval=${intervalMs}ms`);
  return intervalRef;
}

function stopLandingPageScheduler() {
  if (!intervalRef) return;
  clearInterval(intervalRef);
  intervalRef = null;
  // eslint-disable-next-line no-console
  console.log("[marketing:scheduler] stopped");
}

module.exports = {
  startLandingPageScheduler,
  stopLandingPageScheduler,
  runLandingPageSchedulerCycle,
};
