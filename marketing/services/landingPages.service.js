const crypto = require("crypto");
const { Op } = require("sequelize");
const { getLandingPageModel } = require("../models/landingPage");
const { getLandingPageVersionModel } = require("../models/landingPageVersion");
const { getCampaignsReferencingLandingPage } = require("./campaignReferences.service");
const { getDefaultTrackingForNewPage } = require("./globalTracking.service");
const { resolveInitialSections, resolveTemplateDesignSystem } = require("../utils/templateSections");
const { normalizeDesignSystem } = require("../utils/designSystem");
const { normalizeTrackingSettings } = require("../utils/trackingSettings");
const { parseJsonField } = require("../utils/jsonField");
const { getMediaAssetModel } = require("../models/mediaAsset");
const {
  getApiPublicUrl,
  getCampaignAppUrl,
  getLeadSubmitUrl,
  getWebsitePublicUrl,
} = require("../utils/publicUrls");
const { revalidateWebsiteLandingPage } = require("./websiteRevalidate.service");
const { attachCustomHtmlSsr } = require("../utils/customHtmlSsr");

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
  const base = getWebsitePublicUrl();
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

const PAGE_CHROME_VALUES = new Set(["site", "minimal"]);

/** Keep only known page settings with valid values. */
function normalizePageSettings(raw) {
  const input = parseJsonField(raw, {});
  const settings = {};
  if (input && typeof input === "object" && PAGE_CHROME_VALUES.has(input.chrome)) {
    settings.chrome = input.chrome;
  }
  return settings;
}

/** Absolute public URL for the page's OG image (seo.ogImageId may be a media id or a URL). */
async function resolveOgImageUrl(seo) {
  const ref = String(seo?.ogImageId || "").trim();
  if (!ref) return null;
  let url = ref;
  if (!/^https?:\/\//i.test(ref) && !ref.startsWith("/")) {
    const asset = await getMediaAssetModel().findByPk(ref);
    url = asset?.url || "";
  }
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const api = getApiPublicUrl();
  return api && url.startsWith("/") ? `${api}${url}` : null;
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

// Keep in sync with page-builder-nextjs/src/features/landing-pages/utils/publishValidation.ts
const PUBLISH_HERO_SECTION_TYPES = new Set([
  "hero",
  "local-hero",
  "product-hero",
  "simple-hero",
  "industry-hero",
  "cp-hero",
  "cb-hero",
  "pl-hero",
]);

const PUBLISH_LEAD_FORM_SECTION_TYPES = new Set([
  "lead-form",
  "request-demo-form",
  "contact-form",
  "consultation-booking-form",
  "brochure-download-form",
  "callback-request-form",
  "cp-lead-form",
  "cb-lead-form",
  "pl-lead-form",
]);

const PUBLISH_CTA_SECTION_TYPES = new Set([
  ...PUBLISH_HERO_SECTION_TYPES,
  ...PUBLISH_LEAD_FORM_SECTION_TYPES,
  "cta-banner",
  "final-cta-banner",
  "sticky-mobile-cta",
  "cp-pricing",
  "cb-machines",
  "cb-final-cta",
  "pl-founder-note",
]);

/** A section matches when either its wire type or its real renderer slug (renderType) is in the set. */
function sectionMatches(section, typeSet) {
  return typeSet.has(section.type) || (section.renderType ? typeSet.has(section.renderType) : false);
}

function isCustomHtmlSection(section) {
  return (section.renderType || section.type) === "custom-html";
}

function runPublishValidation(page) {
  const errors = [];
  const warnings = [];
  const sections = normalizeSections(page.draftSections);
  const visibleSections = sections.filter((s) => s && s.visible !== false);

  // Imported / freeform pages: every visible section is custom HTML, so hero/CTA
  // checks do not apply (the builder skips them too).
  if (visibleSections.length > 0 && visibleSections.every(isCustomHtmlSection)) {
    return { passed: true, errors, warnings };
  }

  const hasHero = visibleSections.some((s) => sectionMatches(s, PUBLISH_HERO_SECTION_TYPES));
  if (!hasHero) {
    errors.push({
      key: "sections.hero",
      message: "A visible Hero section is required",
    });
  }

  const hasLeadForm = visibleSections.some((s) =>
    sectionMatches(s, PUBLISH_LEAD_FORM_SECTION_TYPES),
  );
  if (!hasLeadForm) {
    warnings.push({
      key: "sections.lead-form",
      message: "Consider adding a Lead Form section",
    });
  }

  const hasCta = visibleSections.some((s) => sectionMatches(s, PUBLISH_CTA_SECTION_TYPES));
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
    if (payload.tracking !== undefined) existing.tracking = normalizeTrackingSettings(payload.tracking);
    if (payload.formSettings !== undefined) existing.formSettings = payload.formSettings;
    if (payload.settings !== undefined) existing.settings = normalizePageSettings(payload.settings);
    if (payload.designSystem !== undefined) existing.designSystem = normalizeDesignSystem(payload.designSystem);
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
  const designSystem =
    payload.designSystem !== undefined
      ? normalizeDesignSystem(payload.designSystem)
      : normalizeDesignSystem(await resolveTemplateDesignSystem(payload.templateId || null));
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
    tracking: normalizeTrackingSettings(payload.tracking || trackingDefaults),
    formSettings: payload.formSettings || defaultFormSettings(),
    settings: normalizePageSettings(payload.settings),
    designSystem,
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
  if (payload.tracking !== undefined) page.tracking = normalizeTrackingSettings(payload.tracking || {});
  if (payload.formSettings !== undefined) page.formSettings = payload.formSettings || {};
  if (payload.settings !== undefined) page.settings = normalizePageSettings(payload.settings);
  if (payload.designSystem !== undefined) page.designSystem = normalizeDesignSystem(payload.designSystem);
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
    page.publishedSections = attachCustomHtmlSsr(injectLeadSubmitUrls(cloneJson(page.draftSections || [])));
    page.publishedDesignSystem = normalizeDesignSystem(page.designSystem);
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

  revalidateWebsiteLandingPage(page.slug);
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
  revalidateWebsiteLandingPage(page.slug);
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
      settings: cloneJson(page.settings || {}),
      designSystem: page.designSystem || null,
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
  revalidateWebsiteLandingPage(page.slug);
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

  const { slug } = page;
  await page.destroy();
  revalidateWebsiteLandingPage(slug);
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

  // Restore into the draft only. Status and published sections are untouched so a
  // live page stays live until the restored draft is explicitly published.
  if (Array.isArray(version.sectionsSnapshot)) {
    page.draftSections = cloneJson(version.sectionsSnapshot);
  }
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
    previewUrl: `${getCampaignAppUrl()}/preview/landing-page/${page.id}?token=${page.previewToken}`,
  };
}

/** Page tracking for public payloads: validated IDs only (invalid legacy values dropped). */
function safeTracking(value) {
  try {
    return normalizeTrackingSettings(value);
  } catch {
    return { captureUtmFields: true };
  }
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
    seo: { ...cloneJson(page.seo || {}), ogImageUrl: await resolveOgImageUrl(page.seo) },
    tracking: safeTracking(page.tracking),
    formSettings: cloneJson(page.formSettings || {}),
    settings: normalizePageSettings(page.settings),
    designSystem: normalizeDesignSystem(page.publishedDesignSystem),
    publishedUrl: page.publishedUrl || buildPublishedUrl(page.slug),
    publishedAt: page.publishedAt,
    updatedAt: page.get("updated_at"),
  };
}

/**
 * Live landing pages for the website sitemap: published (or past-scheduled), not
 * excluded via seo.includeInSitemap=false, and not noindex.
 */
async function listSitemapLandingPages() {
  const LandingPage = getLandingPageModel();
  const now = Date.now();
  const rows = await LandingPage.findAll({
    where: { status: { [Op.in]: ["published", "scheduled"] } },
    attributes: ["slug", "status", "seo", "scheduledAt", "publishedAt", "updated_at"],
    order: [["updated_at", "DESC"]],
  });
  return rows
    .filter((row) => row.status === "published" || (row.scheduledAt && new Date(row.scheduledAt).getTime() <= now))
    .filter((row) => {
      const seo = row.seo || {};
      if (seo.includeInSitemap === false) return false;
      return !/noindex/i.test(String(seo.robots || ""));
    })
    .map((row) => ({ slug: row.slug, lastModified: row.get("updated_at") || row.publishedAt }));
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
    settings: normalizePageSettings(page.settings),
    designSystem: normalizeDesignSystem(page.designSystem),
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
  listSitemapLandingPages,
  normalizePageSettings,
};
