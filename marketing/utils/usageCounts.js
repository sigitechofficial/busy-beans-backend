const { getLandingPageModel } = require("../models/landingPage");
const { parseJsonField } = require("./jsonField");

async function getAllLandingPagesWithSections() {
  const LandingPage = getLandingPageModel();
  const pages = await LandingPage.findAll({
    attributes: ["id", "draftSections", "publishedSections", "formSettings", "templateId"],
  });
  return pages.map((p) => ({
    id: p.id,
    draft: parseJsonField(p.draftSections, []),
    published: parseJsonField(p.publishedSections, []),
    formSettings: parseJsonField(p.formSettings, {}),
    templateId: p.templateId,
  }));
}

function sectionsArray(blob) {
  const parsed = parseJsonField(blob, []);
  return Array.isArray(parsed) ? parsed : [];
}

function walkSections(sections, handlers) {
  if (!Array.isArray(sections)) return;
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    if (handlers.onMediaId && typeof section.content === "object") {
      const contentStr = JSON.stringify(section.content);
      const mediaIds = contentStr.match(/media-upload-\d+/g) || [];
      mediaIds.forEach((id) => handlers.onMediaId(id));
    }
    if (handlers.onGlobalSectionId && section.globalSectionId) {
      handlers.onGlobalSectionId(section.globalSectionId);
    }
    if (handlers.onFormId && section.content?.formId) {
      handlers.onFormId(section.content.formId);
    }
  }
}

/**
 * Returns map of mediaId -> number of landing pages referencing it.
 */
async function getMediaUsageMap() {
  const pages = await getAllLandingPagesWithSections();
  const map = {};

  for (const { draft, published } of pages) {
    const pageMedia = new Set();
    const scan = (sections) => {
      walkSections(sections, {
        onMediaId: (id) => pageMedia.add(id),
      });
    };
    scan(sectionsArray(draft));
    scan(sectionsArray(published));
    pageMedia.forEach((id) => {
      map[id] = (map[id] || 0) + 1;
    });
  }

  return map;
}

async function getMediaUsageCount(mediaId) {
  const map = await getMediaUsageMap();
  return map[mediaId] || 0;
}

async function getGlobalSectionUsageMap() {
  const pages = await getAllLandingPagesWithSections();
  const map = {};

  for (const { draft, published } of pages) {
    const pageIds = new Set();
    const scan = (sections) => {
      walkSections(sections, {
        onGlobalSectionId: (id) => pageIds.add(id),
      });
    };
    scan(sectionsArray(draft));
    scan(sectionsArray(published));
    pageIds.forEach((id) => {
      map[id] = (map[id] || 0) + 1;
    });
  }

  return map;
}

async function getGlobalSectionUsageCount(globalSectionId) {
  const map = await getGlobalSectionUsageMap();
  return map[globalSectionId] || 0;
}

async function getFormUsageMap() {
  const pages = await getAllLandingPagesWithSections();
  const map = {};

  for (const { draft, published, formSettings } of pages) {
    const pageFormIds = new Set();
    const scan = (sections) => {
      walkSections(sections, {
        onFormId: (id) => pageFormIds.add(id),
      });
    };
    scan(sectionsArray(draft));
    scan(sectionsArray(published));
    if (formSettings?.formId) {
      pageFormIds.add(formSettings.formId);
    }
    pageFormIds.forEach((id) => {
      map[id] = (map[id] || 0) + 1;
    });
  }

  return map;
}

async function getFormUsageCount(formId) {
  const map = await getFormUsageMap();
  return map[formId] || 0;
}

async function getCustomTemplateUsageMap() {
  const pages = await getAllLandingPagesWithSections();
  const map = {};
  for (const { templateId } of pages) {
    if (!templateId || !templateId.startsWith("tpl-custom-")) continue;
    map[templateId] = (map[templateId] || 0) + 1;
  }
  return map;
}

module.exports = {
  getMediaUsageMap,
  getMediaUsageCount,
  getGlobalSectionUsageMap,
  getGlobalSectionUsageCount,
  getFormUsageMap,
  getFormUsageCount,
  getCustomTemplateUsageMap,
  getAllLandingPagesWithSections,
  walkSections,
  sectionsArray,
};
