const { getGlobalSectionModel } = require("../models/globalSection");
const { getLandingPageModel } = require("../models/landingPage");
const { defaultContentForType } = require("../utils/sectionDefaults");
const {
  getGlobalSectionUsageMap,
  getGlobalSectionUsageCount,
  sectionsArray,
  walkSections,
} = require("../utils/usageCounts");
function buildGlobalSectionId() {
  return `global-${Date.now()}`;
}

async function listGlobalSections() {
  const GlobalSection = getGlobalSectionModel();
  const rows = await GlobalSection.findAll({ order: [["updated_at", "DESC"]] });
  const usageMap = await getGlobalSectionUsageMap();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    content: row.content,
    usageCount: usageMap[row.id] || 0,
    updatedAt: row.updatedAt,
  }));
}

async function getGlobalSectionById(id) {
  const GlobalSection = getGlobalSectionModel();
  const row = await GlobalSection.findByPk(id);
  if (!row) return null;
  const usageCount = await getGlobalSectionUsageCount(id);
  return { ...row.toJSON(), usageCount };
}

async function createGlobalSection(payload) {
  const GlobalSection = getGlobalSectionModel();
  const type = payload.type || "faq";
  return GlobalSection.create({
    id: payload.id || buildGlobalSectionId(),
    name: payload.name || "Untitled Section",
    type,
    status: payload.status || "draft",
    content: payload.content || defaultContentForType(type),
  });
}

async function updateGlobalSection(id, payload) {
  const GlobalSection = getGlobalSectionModel();
  const row = await GlobalSection.findByPk(id);
  if (!row) return null;
  if (payload.name !== undefined) row.name = payload.name;
  if (payload.status !== undefined) row.status = payload.status;
  if (payload.content !== undefined) row.content = payload.content;
  await row.save();
  return getGlobalSectionById(id);
}

async function deleteGlobalSection(id) {
  const usageCount = await getGlobalSectionUsageCount(id);
  if (usageCount > 0) {
    return { deleted: false, reason: "IN_USE", usageCount };
  }
  const GlobalSection = getGlobalSectionModel();
  const row = await GlobalSection.findByPk(id);
  if (!row) return { deleted: false, reason: "NOT_FOUND" };
  await row.destroy();
  return { deleted: true };
}

function detachGlobalSectionFromSections(sections, globalSectionId) {
  let count = 0;
  const updated = sectionsArray(sections).map((section) => {
    if (section?.globalSectionId === globalSectionId) {
      count += 1;
      const clone = { ...section };
      delete clone.globalSectionId;
      return clone;
    }
    return section;
  });
  return { updated, count };
}

async function detachGlobalSection(id) {
  const LandingPage = getLandingPageModel();
  const pages = await LandingPage.findAll();
  let sectionsDetached = 0;
  let pagesTouched = 0;

  for (const page of pages) {
    const draft = sectionsArray(page.draftSections);
    const published = sectionsArray(page.publishedSections);
    const draftResult = detachGlobalSectionFromSections(draft, id);
    const pubResult = detachGlobalSectionFromSections(published, id);
    const pageCount = draftResult.count + pubResult.count;
    if (pageCount > 0) {
      sectionsDetached += pageCount;
      pagesTouched += 1;
      page.draftSections = draftResult.updated;
      page.publishedSections = pubResult.updated;
      await page.save();
    }
  }

  return { sectionsDetached, pagesTouched };
}

module.exports = {
  listGlobalSections,
  getGlobalSectionById,
  createGlobalSection,
  updateGlobalSection,
  deleteGlobalSection,
  detachGlobalSection,
};
