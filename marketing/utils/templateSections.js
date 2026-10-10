const { getCustomTemplateModel } = require("../models/customTemplate");
const { getBuiltinTemplateOverrideModel } = require("../models/builtinTemplateOverride");
const { defaultContentForType } = require("./sectionDefaults");

function sectionId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function buildSection(type, content = {}) {
  return {
    id: sectionId(type),
    type,
    visible: true,
    content: { ...defaultContentForType(type), ...content },
  };
}

const BUILTIN_TEMPLATE_SECTIONS = {
  "tpl-office-coffee": ["hero", "benefits", "lead-form"],
  "tpl-hotel-coffee": ["hero", "benefits", "faq", "lead-form"],
  "tpl-commercial-machines": ["hero", "benefits", "cta-banner", "lead-form"],
  "tpl-local-city": ["hero", "benefits", "lead-form"],
  default: ["hero", "lead-form"],
};

function sectionsFromTypes(types) {
  return types.map((type) => buildSection(type));
}

function getBuiltinSectionTypes(templateId) {
  return BUILTIN_TEMPLATE_SECTIONS[templateId] || BUILTIN_TEMPLATE_SECTIONS.default;
}

async function resolveInitialSections(templateId) {
  if (!templateId) {
    return sectionsFromTypes(BUILTIN_TEMPLATE_SECTIONS.default);
  }

  try {
    const CustomTemplate = getCustomTemplateModel();
    const custom = await CustomTemplate.findByPk(templateId);
    if (custom && Array.isArray(custom.initialSections) && custom.initialSections.length > 0) {
      return custom.initialSections;
    }
  } catch {
    // table may not exist during early boot
  }

  try {
    const BuiltinOverride = getBuiltinTemplateOverrideModel();
    const override = await BuiltinOverride.findByPk(templateId);
    if (override && Array.isArray(override.initialSections) && override.initialSections.length > 0) {
      return override.initialSections;
    }
  } catch {
    // ignore
  }

  return sectionsFromTypes(getBuiltinSectionTypes(templateId));
}

/** Page theme of a custom template (imported pages keep their designSystem), or null. */
async function resolveTemplateDesignSystem(templateId) {
  if (!templateId) return null;
  try {
    const custom = await getCustomTemplateModel().findByPk(templateId, { attributes: ["id", "designSystem"] });
    return custom?.designSystem || null;
  } catch {
    return null;
  }
}

module.exports = {
  resolveInitialSections,
  resolveTemplateDesignSystem,
  getBuiltinSectionTypes,
  sectionsFromTypes,
  buildSection,
};
