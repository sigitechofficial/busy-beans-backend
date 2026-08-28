const crypto = require("crypto");
const { Op } = require("sequelize");
const { getLandingPageModel } = require("../models/landingPage");
const { getLandingPageVersionModel } = require("../models/landingPageVersion");
const { getCampaignsReferencingLandingPage } = require("./campaignReferences.service");
const { getDefaultTrackingForNewPage } = require("./globalTracking.service");
const { resolveInitialSections } = require("../utils/templateSections");
const { parseJsonField } = require("../utils/jsonField");

function cloneJson(input) {
  return JSON.parse(JSON.stringify(input));
}

function buildPageId() {
  return `lp-${Date.now()}`;
}

function buildPreviewToken() {
  return crypto.randomBytes(16).toString("hex");
}

function buildPublishedUrl(slug) {
  const base = (process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/lp/${slug}`;
}

function defaultSeo(slug) {
  return {
    metaTitle: "",
    metaDescription: "",
    slug,
    canonicalUrl: "",
    ogTitle: "",
    ogDescription: "",
    ogImageId: "",
    robots: "index, follow",
    includeInSitemap: true,
    enableFaqSchema: false,
    enableLocalBusinessSchema: false,
    customSchemaJson: "",
  };
}

function getLeadSubmitUrl() {
  const configured = process.env.DEFAULT_LEAD_SUBMIT_URL;
  if (configured) return configured;
  const site = (process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  if (site) return `${site}/api/public/lead-submissions`;
  return null;
}

function injectLeadSubmitUrls(sections) {
  const submitUrl = getLeadSubmitUrl();
  if (!submitUrl || !Array.isArray(sections)) return sections;
  return sections.map((section) => {
    if (!section || section.type !== "lead-form") return section;
    const content = { ...(section.content || {}) };
    if (!content.submitApiUrl) content.submitApiUrl = submitUrl;
    return { ...section, content };
  });
}

function defaultFormSettings() {
  return {
    fields: [],
    requiredFields: [],
    thankYouMessage: "Thanks! We will get back to you soon.",
    notificationEmails: [],
    testMode: false,
    enableCrmSync: false,
  };
}

function validateSlug(slug) {
  return /^[a-z0-9-]{3,}$/.test(slug);
}

function normalizeSections(sections) {
  const parsed = parseJsonField(sections, []);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

function runPublishValidation(page) {
  const errors = [];
  const warnings = [];
  const sections = normalizeSections(page.draftSections);
  const visibleSections = sections.filter((s) => s && s.visible !== false);

  const hasHero = visibleSections.some((s) => s.type === "hero");
  if (!hasHero) {
    errors.push({
      key: "sections.hero",
      message: "A visible Hero section is required",
    });
  }

  const hasLeadForm = visibleSections.some((s) => s.type === "lead-form");
  if (!hasLeadForm) {
    warnings.push({
      key: "sections.lead-form",
      message: "Consider adding a Lead Form section",
    });
  }

  const hasCta = visibleSections.some((s) =>
    ["hero", "cta-banner", "lead-form"].includes(s.type),
  );
  if (!hasCta) {
    errors.push({
      key: "sections.cta",
      message: "At least one visible CTA section is required",
    });
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

async function getNextVersionNumber(landingPageId) {
  const LandingPageVersion = getLandingPageVersionModel();
  const latest = await LandingPageVersion.findOne({
    where: { landingPageId },
    order: [["version_number", "DESC"]],
  });
  return latest ? latest.versionNumber + 1 : 1;
}

async function createVersion({ landingPageId, action, publishedBy, notes, sectionsSnapshot }) {
  const LandingPageVersion = getLandingPageVersionModel();
  const versionNumber = await getNextVersionNumber(landingPageId);
  return LandingPageVersion.create({
    landingPageId,
    versionNumber,
    action,
    publishedBy: publishedBy || "System",
    publishedAt: new Date(),
    notes: notes || null,
    snapshotSectionCount: Array.isArray(sectionsSnapshot) ? sectionsSnapshot.length : 0,
    sectionsSnapshot: sectionsSnapshot || null,
  });
}

async function listLandingPages() {
  const LandingPage = getLandingPageModel();
  const rows = await LandingPage.findAll({
    order: [["updated_at", "DESC"]],
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    templateName: row.templateId || undefined,
    updatedBy: row.updatedBy || "System",
    updatedAt: row.updatedAt,
    publishedUrl: row.publishedUrl || undefined,
  }));
}

async function getLandingPageById(id) {
  const LandingPage = getLandingPageModel();
  return LandingPage.findByPk(id);
}

async function createLandingPage(payload, actor) {
  const LandingPage = getLandingPageModel();
  const slug = String(payload.slug || "").trim().toLowerCase();
  if (!validateSlug(slug)) {
    const error = new Error("Invalid slug format.");
    error.code = "INVALID_SLUG";
    throw error;
  }

  const existing = await LandingPage.findOne({ where: { slug } });
  if (existing) {
    if (payload.title !== undefined) existing.title = payload.title;
    if (payload.templateId !== undefined) existing.templateId = payload.templateId;
    if (payload.campaignName !== undefined) existing.campaignName = payload.campaignName;
    if (payload.objective !== undefined) existing.objective = payload.objective;
    if (payload.targetAudience !== undefined) existing.targetAudience = payload.targetAudience;
    if (payload.city !== undefined) existing.city = payload.city;
    if (payload.sections !== undefined) {
      existing.draftSections = normalizeSections(payload.sections);
    }
    if (payload.seo !== undefined) existing.seo = payload.seo;
    if (payload.tracking !== undefined) existing.tracking = payload.tracking;
    if (payload.formSettings !== undefined) existing.formSettings = payload.formSettings;
    existing.updatedBy = actor?.sub || existing.updatedBy;
    await existing.save();
    return existing;
  }

  const id = payload.id || buildPageId();
  let draftSections = normalizeSections(payload.sections);
  if (!draftSections.length) {
    draftSections = normalizeSections(
      await resolveInitialSections(payload.templateId || null),
    );
  }
  const trackingDefaults = await getDefaultTrackingForNewPage();
  const page = await LandingPage.create({
    id,
    title: payload.title || "Untitled Landing Page",
    slug,
    status: "draft",
    templateId: payload.templateId || null,
    campaignName: payload.campaignName || null,
    objective: payload.objective || null,
    targetAudience: payload.targetAudience || null,
    city: payload.city || null,
    draftSections,
    seo: payload.seo || defaultSeo(slug),
    tracking: payload.tracking || trackingDefaults,
    formSettings: payload.formSettings || defaultFormSettings(),
    previewToken: buildPreviewToken(),
    createdBy: actor?.sub || null,
    updatedBy: actor?.sub || null,
  });

  await createVersion({
    landingPageId: page.id,
    action: "draft_created",
    publishedBy: actor?.email || actor?.sub || "System",
    sectionsSnapshot: cloneJson(draftSections),
  });

  return page;
}

async function patchDraft(id, payload, actor) {
  const page = await getLandingPageById(id);
  if (!page) return null;

  if (payload.title !== undefined) page.title = payload.title;
  if (payload.sections !== undefined) page.draftSections = normalizeSections(payload.sections);
  if (payload.seo !== undefined) page.seo = payload.seo || {};
  if (payload.tracking !== undefined) page.tracking = payload.tracking || {};
  if (payload.formSettings !== undefined) page.formSettings = payload.formSettings || {};
  page.updatedBy = actor?.sub || page.updatedBy;
  await page.save();

  return page;
}

async function publishLandingPage(id, payload, actor) {
  const page = await getLandingPageById(id);
  if (!page) return null;

  const validation = runPublishValidation(page);
  if (!validation.passed) {
    const error = new Error("Page validation failed.");
    error.code = "VALIDATION_FAILED";
    error.details = validation;
    throw error;
  }

  const now = new Date();
  const scheduledAt = payload?.scheduledAt ? new Date(payload.scheduledAt) : null;
  const unpublishAt = payload?.unpublishAt ? new Date(payload.unpublishAt) : null;

  const isFutureSchedule = scheduledAt && scheduledAt.getTime() > now.getTime();
  page.scheduledAt = scheduledAt;
  page.unpublishAt = unpublishAt;
  page.updatedBy = actor?.sub || page.updatedBy;

  if (isFutureSchedule) {
    page.status = "scheduled";
    page.publishedSections = null;
    page.publishedAt = null;
  } else {
    page.status = "published";
    page.publishedSections = injectLeadSubmitUrls(cloneJson(page.draftSections || []));
    page.publishedAt = now;
    page.publishedUrl = buildPublishedUrl(page.slug);
  }

  await page.save();
  await createVersion({
    landingPageId: page.id,
    action: isFutureSchedule ? "scheduled" : "published",
    publishedBy: actor?.email || actor?.sub || "System",
    notes: payload?.notes || null,
    sectionsSnapshot: cloneJson(page.draftSections || []),
  });

  return page;
}

async function unpublishLandingPage(id, actor) {
  const page = await getLandingPageById(id);
  if (!page) return null;
  page.status = "draft";
  page.publishedAt = null;
  page.scheduledAt = null;
  page.updatedBy = actor?.sub || page.updatedBy;
  await page.save();
  return page;
}

async function duplicateLandingPage(id, actor) {
  const page = await getLandingPageById(id);
  if (!page) return null;
  const LandingPage = getLandingPageModel();

  const baseSlug = `${page.slug}-copy`;
  let candidateSlug = baseSlug;
  let count = 1;
  while (
    // eslint-disable-next-line no-await-in-loop
    await LandingPage.findOne({ where: { slug: candidateSlug, id: { [Op.ne]: page.id } } })
  ) {
    count += 1;
    candidateSlug = `${baseSlug}-${count}`;
  }

  return createLandingPage(
    {
      title: `${page.title} (Copy)`,
      slug: candidateSlug,
      templateId: page.templateId,
      campaignName: page.campaignName,
      objective: page.objective,
      targetAudience: page.targetAudience,
      city: page.city,
      sections: cloneJson(page.draftSections || []),
      seo: cloneJson(page.seo || {}),
      tracking: cloneJson(page.tracking || {}),
      formSettings: cloneJson(page.formSettings || {}),
    },
    actor,
  );
}

async function archiveLandingPage(id, actor) {
  const page = await getLandingPageById(id);
  if (!page) return null;
  page.status = "archived";
  page.archivedAt = new Date();
  page.updatedBy = actor?.sub || page.updatedBy;
  await page.save();
  return page;
}

async function deleteLandingPage(id) {
  const page = await getLandingPageById(id);
  if (!page) return { deleted: false, reason: "NOT_FOUND" };

  const referencingCampaigns = await getCampaignsReferencingLandingPage(page);
  if (referencingCampaigns.length > 0) {
    return {
      deleted: false,
      reason: "IN_USE",
      campaigns: referencingCampaigns,
    };
  }

  await page.destroy();
  return { deleted: true };
}

async function restoreLandingPageVersion(id, versionNumber, actor) {
  const page = await getLandingPageById(id);
  if (!page) return null;
  const LandingPageVersion = getLandingPageVersionModel();
  const version = await LandingPageVersion.findOne({
    where: { landingPageId: id, versionNumber },
  });
  if (!version) return null;

  if (Array.isArray(version.sectionsSnapshot)) {
    page.draftSections = cloneJson(version.sectionsSnapshot);
  }
  page.status = "draft";
  page.updatedBy = actor?.sub || page.updatedBy;
  await page.save();
  return page;
}

async function regeneratePreviewToken(id) {
  const page = await getLandingPageById(id);
  if (!page) return null;
  if (!page.previewToken) {
    page.previewToken = buildPreviewToken();
    await page.save();
  }
  return {
    token: page.previewToken,
    previewUrl: `${(process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "")}/preview/landing-page/${page.id}?token=${page.previewToken}`,
  };
}

async function getPublicLandingPageBySlug(slug) {
  const LandingPage = getLandingPageModel();
  const page = await LandingPage.findOne({
    where: { slug: String(slug || "").trim().toLowerCase() },
  });
  if (!page) return null;

  if (page.status === "draft" || page.status === "archived") return null;
  if (
    page.status === "scheduled" &&
    page.scheduledAt &&
    new Date(page.scheduledAt).getTime() > Date.now()
  ) {
    return null;
  }

  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    status: page.status,
    templateId: page.templateId,
    campaignName: page.campaignName,
    objective: page.objective,
    targetAudience: page.targetAudience,
    city: page.city,
    sections: cloneJson(page.publishedSections || []),
    seo: cloneJson(page.seo || {}),
    tracking: cloneJson(page.tracking || {}),
    formSettings: cloneJson(page.formSettings || {}),
    publishedUrl: page.publishedUrl || buildPublishedUrl(page.slug),
    publishedAt: page.publishedAt,
  };
}

async function getPreviewLandingPageByToken(pageId, token) {
  const page = await getLandingPageById(pageId);
  if (!page) return null;
  if (!token || token !== page.previewToken) return "invalid_token";

  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    status: page.status,
    templateId: page.templateId,
    campaignName: page.campaignName,
    objective: page.objective,
    targetAudience: page.targetAudience,
    city: page.city,
    sections: cloneJson(page.draftSections || []),
    seo: cloneJson(page.seo || {}),
    tracking: cloneJson(page.tracking || {}),
    formSettings: cloneJson(page.formSettings || {}),
  };
}

module.exports = {
  injectLeadSubmitUrls,
  listLandingPages,
  getLandingPageById,
  createLandingPage,
  patchDraft,
  runPublishValidation,
  publishLandingPage,
  unpublishLandingPage,
  duplicateLandingPage,
  archiveLandingPage,
  deleteLandingPage,
  restoreLandingPageVersion,
  regeneratePreviewToken,
  getPublicLandingPageBySlug,
  getPreviewLandingPageByToken,
};
