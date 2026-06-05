const { getSectionCatalogOverrideModel } = require("../models/sectionCatalogOverride");

function toRecord(row) {
  return {
    active: Boolean(row.active),
    label: row.label,
    description: row.description,
    defaultContent: row.defaultContent,
    updatedAt: row.updatedAt,
  };
}

async function listOverrides() {
  const SectionCatalogOverride = getSectionCatalogOverrideModel();
  const rows = await SectionCatalogOverride.findAll();
  const record = {};
  rows.forEach((row) => {
    record[row.sectionType] = toRecord(row);
  });
  return record;
}

async function upsertOverride(sectionType, payload) {
  const SectionCatalogOverride = getSectionCatalogOverrideModel();
  let row = await SectionCatalogOverride.findByPk(sectionType);
  if (!row) {
    row = await SectionCatalogOverride.create({
      sectionType,
      active: payload.active !== undefined ? payload.active : true,
      label: payload.label || null,
      description: payload.description || null,
      defaultContent: payload.defaultContent || null,
    });
  } else {
    if (payload.active !== undefined) row.active = payload.active;
    if (payload.label !== undefined) row.label = payload.label;
    if (payload.description !== undefined) row.description = payload.description;
    if (payload.defaultContent !== undefined) row.defaultContent = payload.defaultContent;
    await row.save();
  }
  return { sectionType: row.sectionType, ...toRecord(row) };
}

async function setOverrideActive(sectionType, active) {
  return upsertOverride(sectionType, { active: Boolean(active) });
}

async function deleteOverride(sectionType) {
  const SectionCatalogOverride = getSectionCatalogOverrideModel();
  const row = await SectionCatalogOverride.findByPk(sectionType);
  if (!row) return false;
  await row.destroy();
  return true;
}

module.exports = {
  listOverrides,
  upsertOverride,
  setOverrideActive,
  deleteOverride,
};
