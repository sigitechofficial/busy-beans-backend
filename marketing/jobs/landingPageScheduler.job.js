const { Op } = require("sequelize");
const { getLandingPageModel } = require("../models/landingPage");
const { getLandingPageVersionModel } = require("../models/landingPageVersion");
const { injectLeadSubmitUrls } = require("../services/landingPages.service");
const { revalidateWebsiteLandingPage } = require("../services/websiteRevalidate.service");
const { attachCustomHtmlSsr } = require("../utils/customHtmlSsr");
const { normalizeDesignSystem } = require("../utils/designSystem");
const { syncPaidOrders } = require("../services/orderAttribution.service");
const { runRollupCycle: runPageStatsRollup } = require("../services/pageStats.service");
const { purgeOldConsent } = require("../services/consentLog.service");
const { purgeOldPiiAccess } = require("../services/piiAccess.service");

let lastConsentPurgeAt = 0;

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
      publishedSections: attachCustomHtmlSsr(
        injectLeadSubmitUrls(JSON.parse(JSON.stringify(page.draftSections || []))),
      ),
      publishedDesignSystem: normalizeDesignSystem(page.designSystem),
      publishedAt: now,
      updatedBy: "scheduler",
    });
    // eslint-disable-next-line no-await-in-loop
    await createVersion(page.id, "published", page.draftSections || []);
    revalidateWebsiteLandingPage(page.slug);
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
    revalidateWebsiteLandingPage(page.slug);
  }

  return pages.length;
}

/** Revenue attribution: emit order_completed for attributed orders that are now paid. */
async function runOrderRevenueSync() {
  try {
    const result = await syncPaidOrders();
    return result.paid + result.voided + (result.inherited || 0) > 0 ? result : null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[marketing:scheduler] order revenue sync failed:", error.message);
    return null;
  }
}

async function runLandingPageSchedulerCycle() {
  if (running) return { skipped: true };
  running = true;
  try {
    const published = await runScheduledPublishCycle();
    const unpublished = await runScheduledUnpublishCycle();
    const orders = await runOrderRevenueSync();
    if (orders) {
      // eslint-disable-next-line no-console
      console.log(`[marketing:scheduler] orders paid=${orders.paid} voided=${orders.voided} repeat-credited=${orders.inherited || 0}`);
    }
    // Reporting rollups for recent closed days (self-gated to every 15 min).
    await runPageStatsRollup().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[marketing:scheduler] page stats rollup failed:", error.message);
    });
    // Consent log retention: at most once an hour.
    if (Date.now() - lastConsentPurgeAt > 60 * 60 * 1000) {
      lastConsentPurgeAt = Date.now();
      await purgeOldConsent().catch((error) => {
        // eslint-disable-next-line no-console
        console.error("[marketing:scheduler] consent log purge failed:", error.message);
      });
      await purgeOldPiiAccess().catch((error) => {
        // eslint-disable-next-line no-console
        console.error("[marketing:scheduler] customer data access log purge failed:", error.message);
      });
    }
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
