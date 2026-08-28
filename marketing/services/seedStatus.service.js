const { Op } = require("sequelize");
const manifest = require("../data/seedManifest");
const { getGlobalTrackingSettingModel } = require("../models/globalTrackingSetting");
const { getProductModel } = require("../models/product");
const { getMediaAssetModel } = require("../models/mediaAsset");
const { getSectionCatalogOverrideModel } = require("../models/sectionCatalogOverride");
const { getProductListingCatalogOverrideModel } = require("../models/productListingCatalogOverride");
const { getBuiltinTemplateOverrideModel } = require("../models/builtinTemplateOverride");
const { getGlobalSectionModel } = require("../models/globalSection");
const { getFormModel } = require("../models/form");
const { getLandingPageModel } = require("../models/landingPage");
const { getCampaignModel } = require("../models/campaign");
const { getMarketingSeedStatusModel } = require("../models/marketingSeedStatus");

function completenessFromCounts(recordCount, expectedCount, { partialMin = 1 } = {}) {
  if (recordCount <= 0) return "empty";
  if (recordCount >= expectedCount) return "full";
  if (recordCount >= partialMin) return "partial";
  return "empty";
}

function moduleStatus(recordCount, expectedCount, seeded, extras = {}) {
  const completeness = completenessFromCounts(recordCount, expectedCount, extras);
  return {
    seeded: Boolean(seeded),
    completeness,
    recordCount,
    expectedCount,
    ...extras.meta,
  };
}

async function probeTracking() {
  const expected = manifest.EXPECTED.tracking;
  try {
    const Model = getGlobalTrackingSettingModel();
    const row = await Model.findByPk(1);
    const recordCount = row ? 1 : 0;
    return moduleStatus(recordCount, expected, recordCount >= 1);
  } catch {
    return moduleStatus(0, expected, false);
  }
}

async function probeProducts() {
  const expected = manifest.EXPECTED.products;
  try {
    const Product = getProductModel();
    const rows = await Product.findAll({
      where: { slug: { [Op.in]: manifest.PRODUCT_SLUGS }, status: { [Op.ne]: "archived" } },
      attributes: ["slug"],
    });
    const found = new Set(rows.map((r) => r.slug));
    const recordCount = manifest.PRODUCT_SLUGS.filter((s) => found.has(s)).length;
    return moduleStatus(recordCount, expected, recordCount >= expected);
  } catch {
    return moduleStatus(0, expected, false);
  }
}

async function probeMedia() {
  const expected = manifest.EXPECTED.media;
  try {
    const MediaAsset = getMediaAssetModel();
    const rows = await MediaAsset.findAll({ attributes: ["name"] });
    const names = new Set(rows.map((r) => String(r.name || "").trim().toLowerCase()));
    const recordCount = manifest.MEDIA_NAMES.filter((n) =>
      names.has(n.trim().toLowerCase()),
    ).length;
    const seeded = recordCount >= expected || rows.length >= 4;
    return moduleStatus(recordCount, expected, seeded);
  } catch {
    return moduleStatus(0, expected, false);
  }
}

async function probeSectionCatalog() {
  const expected = manifest.EXPECTED.sectionCatalog;
  try {
    const Model = getSectionCatalogOverrideModel();
    const rows = await Model.findAll({ attributes: ["sectionType", "active"] });
    const types = new Set(rows.map((r) => r.sectionType));
    const anchorsOk = manifest.SECTION_CATALOG_ANCHORS.every((t) => types.has(t));
    const recordCount = rows.length;
    const minPartial = Math.ceil(expected * manifest.SECTION_CATALOG_PARTIAL_RATIO);
    const seeded =
      recordCount >= expected ||
      (anchorsOk && recordCount >= minPartial);
    return moduleStatus(recordCount, expected, seeded);
  } catch {
    return moduleStatus(0, expected, false);
  }
}

async function probeProductListingCatalog() {
  const expected = manifest.EXPECTED.productListingCatalog;
  try {
    const Model = getProductListingCatalogOverrideModel();
    const rows = await Model.findAll({ attributes: ["listingType"] });
    const types = new Set(rows.map((r) => r.listingType));
    const recordCount = manifest.PRODUCT_LISTING_TYPES.filter((t) => types.has(t)).length;
    return moduleStatus(recordCount, expected, recordCount >= expected);
  } catch {
    return moduleStatus(0, expected, false);
  }
}

async function probeTemplates() {
  const expected = manifest.EXPECTED.templates;
  try {
    const Model = getBuiltinTemplateOverrideModel();
    const rows = await Model.findAll({
      where: { templateId: { [Op.in]: manifest.BUILTIN_TEMPLATE_IDS } },
      attributes: ["templateId", "initialSections"],
    });
    const withStacks = rows.filter(
      (r) => Array.isArray(r.initialSections) && r.initialSections.length > 0,
    );
    const recordCount = withStacks.length;
    const seeded = recordCount >= manifest.TEMPLATES_MIN_FOR_SEEDED;
    return moduleStatus(recordCount, expected, seeded);
  } catch {
    return moduleStatus(0, expected, false);
  }
}

async function probeGlobalSections() {
  const expected = manifest.EXPECTED.globalSections;
  try {
    const Model = getGlobalSectionModel();
    const rows = await Model.findAll({ attributes: ["name"] });
    const names = new Set(rows.map((r) => String(r.name || "").trim().toLowerCase()));
    const recordCount = manifest.GLOBAL_SECTION_NAMES.filter((n) =>
      names.has(n.trim().toLowerCase()),
    ).length;
    return moduleStatus(recordCount, expected, recordCount >= expected);
  } catch {
    return moduleStatus(0, expected, false);
  }
}

async function probeForms() {
  const expected = manifest.EXPECTED.forms;
  try {
    const Form = getFormModel();
    const rows = await Form.findAll({
      where: { slug: { [Op.in]: manifest.FORM_SLUGS }, status: { [Op.ne]: "archived" } },
      attributes: ["slug"],
    });
    const found = new Set(rows.map((r) => r.slug));
    const recordCount = manifest.FORM_SLUGS.filter((s) => found.has(s)).length;
    return moduleStatus(recordCount, expected, recordCount >= expected);
  } catch {
    return moduleStatus(0, expected, false);
  }
}

async function probeLandingPages() {
  const expected = manifest.EXPECTED.landingPages;
  try {
    const LandingPage = getLandingPageModel();
    const rows = await LandingPage.findAll({
      where: { slug: { [Op.in]: manifest.LANDING_PAGE_SLUGS } },
      attributes: ["slug", "status"],
    });
    const recordCount = rows.length;
    const published = rows.some((r) => r.status === "published");
    return moduleStatus(recordCount, expected, recordCount >= expected && published);
  } catch {
    return moduleStatus(0, expected, false);
  }
}

async function probeCampaigns() {
  const expected = manifest.EXPECTED.campaigns;
  try {
    const Campaign = getCampaignModel();
    const rows = await Campaign.findAll({
      where: { status: { [Op.ne]: "archived" } },
      attributes: ["name"],
    });
    const names = rows.map((r) => String(r.name || "").trim().toLowerCase());
    const recordCount = manifest.CAMPAIGN_NAMES.filter((n) =>
      names.includes(n.trim().toLowerCase()),
    ).length;
    return moduleStatus(recordCount, expected, recordCount >= expected);
  } catch {
    return moduleStatus(0, expected, false);
  }
}

const PROBES = {
  tracking: probeTracking,
  products: probeProducts,
  media: probeMedia,
  sectionCatalog: probeSectionCatalog,
  productListingCatalog: probeProductListingCatalog,
  templates: probeTemplates,
  globalSections: probeGlobalSections,
  forms: probeForms,
  landingPages: probeLandingPages,
  campaigns: probeCampaigns,
};

async function loadStoredMeta() {
  try {
    const Model = getMarketingSeedStatusModel();
    const rows = await Model.findAll();
    return Object.fromEntries(rows.map((r) => [r.moduleKey, r]));
  } catch {
    return {};
  }
}

function mergeWithStored(derived, stored) {
  if (!stored) return derived;
  return {
    ...derived,
    syncedAt: stored.syncedAt || undefined,
    syncedBy: stored.syncedBy || undefined,
  };
}

async function getSeedStatus() {
  const storedByModule = await loadStoredMeta();
  const modules = {};

  for (const key of manifest.MODULE_KEYS) {
    // eslint-disable-next-line no-await-in-loop
    const derived = await PROBES[key]();
    modules[key] = mergeWithStored(derived, storedByModule[key]);
  }

  return {
    checkedAt: new Date().toISOString(),
    modules,
  };
}

async function patchSeedStatus(moduleKey, payload, actor) {
  if (!manifest.MODULE_KEYS.includes(moduleKey)) {
    const error = new Error("Unknown seed module key.");
    error.code = "INVALID_MODULE";
    throw error;
  }

  const Model = getMarketingSeedStatusModel();
  const expectedCount = manifest.EXPECTED[moduleKey] ?? 0;
  let row = await Model.findByPk(moduleKey);

  const allowedCompleteness = ["full", "partial", "empty"];
  const completeness = payload.completeness || "full";
  if (!allowedCompleteness.includes(completeness)) {
    const error = new Error("completeness must be full, partial, or empty.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  const patch = {
    seeded: payload.seeded !== undefined ? Boolean(payload.seeded) : true,
    completeness,
    recordCount: Number(payload.recordCount ?? expectedCount),
    expectedCount: Number(payload.expectedCount ?? expectedCount),
    syncedAt: new Date(),
    syncedBy: actor?.sub || actor?.email || null,
  };

  if (!row) {
    row = await Model.create({ moduleKey, ...patch });
  } else {
    Object.assign(row, patch);
    await row.save();
  }

  return {
    module: moduleKey,
    seeded: row.seeded,
    completeness: row.completeness,
    recordCount: row.recordCount,
    expectedCount: row.expectedCount,
    syncedAt: row.syncedAt,
    syncedBy: row.syncedBy,
  };
}

module.exports = {
  getSeedStatus,
  patchSeedStatus,
};
