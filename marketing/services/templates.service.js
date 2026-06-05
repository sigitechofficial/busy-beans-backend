const { getCustomTemplateModel } = require("../models/customTemplate");
const { getBuiltinTemplateOverrideModel } = require("../models/builtinTemplateOverride");
const { getCustomTemplateUsageMap } = require("../utils/usageCounts");

function buildCustomTemplateId() {
  return `tpl-custom-${Date.now()}`;
}

async function listCustomTemplates() {
  const CustomTemplate = getCustomTemplateModel();
  const rows = await CustomTemplate.findAll({ order: [["updated_at", "DESC"]] });
  const usageMap = await getCustomTemplateUsageMap();
  return rows.map((row) => ({
    ...row.toJSON(),
    usageCount: usageMap[row.id] || row.usageCount || 0,
  }));
}

async function getCustomTemplateById(id) {
  const CustomTemplate = getCustomTemplateModel();
  return CustomTemplate.findByPk(id);
}

async function createCustomTemplate(payload) {
  const CustomTemplate = getCustomTemplateModel();
  return CustomTemplate.create({
    id: payload.id || buildCustomTemplateId(),
    specIndex: payload.specIndex ?? 0,
    name: payload.name || "Custom Template",
    category: payload.category || "",
    objective: payload.objective || "",
    audience: payload.audience || "",
    useCase: payload.useCase || null,
    mainCta: payload.mainCta || "",
    urlExamples: payload.urlExamples || [],
    thumbnailTone: payload.thumbnailTone || "",
    sectionTypes: payload.sectionTypes || [],
    requiredSectionTypes: payload.requiredSectionTypes || [],
    status: payload.status || "draft",
    description: payload.description || null,
    initialSections: payload.initialSections || null,
    usageCount: 0,
  });
}

const CUSTOM_TEMPLATE_STATUSES = ["approved", "draft", "retired", "archived"];

function normalizeCustomTemplateStatus(status) {
  if (status === undefined || status === null) return undefined;
  const value = String(status).trim().toLowerCase();
  if (value === "archived") return "retired";
  return value;
}

async function updateCustomTemplate(id, payload) {
  const CustomTemplate = getCustomTemplateModel();
  const row = await CustomTemplate.findByPk(id);
  if (!row) return null;

  if (payload.status !== undefined) {
    const normalized = normalizeCustomTemplateStatus(payload.status);
    if (!CUSTOM_TEMPLATE_STATUSES.includes(String(payload.status).trim().toLowerCase())) {
      const error = new Error("Invalid template status.");
      error.code = "VALIDATION_ERROR";
      throw error;
    }
    payload = { ...payload, status: normalized };
  }

  const fields = [
    "specIndex",
    "name",
    "category",
    "objective",
    "audience",
    "useCase",
    "mainCta",
    "urlExamples",
    "thumbnailTone",
    "sectionTypes",
    "requiredSectionTypes",
    "status",
    "description",
    "initialSections",
  ];
  fields.forEach((field) => {
    if (payload[field] !== undefined) row[field] = payload[field];
  });
  await row.save();
  return row;
}

async function deleteCustomTemplate(id) {
  const CustomTemplate = getCustomTemplateModel();
  const row = await CustomTemplate.findByPk(id);
  if (!row) return false;
  await row.destroy();
  return true;
}

async function getBuiltinOverride(templateId) {
  const BuiltinOverride = getBuiltinTemplateOverrideModel();
  const row = await BuiltinOverride.findByPk(templateId);
  return {
    initialSections: row?.initialSections || null,
  };
}

async function upsertBuiltinOverride(templateId, payload) {
  const BuiltinOverride = getBuiltinTemplateOverrideModel();
  let row = await BuiltinOverride.findByPk(templateId);
  if (!row) {
    row = await BuiltinOverride.create({
      templateId,
      initialSections: payload.initialSections || null,
    });
  } else {
    row.initialSections = payload.initialSections || null;
    await row.save();
  }
  return { initialSections: row.initialSections };
}

module.exports = {
  listCustomTemplates,
  getCustomTemplateById,
  createCustomTemplate,
  updateCustomTemplate,
  deleteCustomTemplate,
  getBuiltinOverride,
  upsertBuiltinOverride,
};
