const { Op } = require("sequelize");
const { getFormModel } = require("../models/form");
const { getFormUsageMap, getFormUsageCount } = require("../utils/usageCounts");
const { defaultContentForType } = require("../utils/sectionDefaults");

function buildFormId() {
  return `form-${Date.now()}`;
}

function slugify(name) {
  return String(name || "form")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

async function ensureUniqueSlug(baseSlug, excludeId) {
  const Form = getFormModel();
  let candidate = baseSlug;
  let count = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await Form.findOne({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      },
    });
    if (!existing) return candidate;
    count += 1;
    candidate = `${baseSlug}-${count}`;
  }
}

async function listForms() {
  const Form = getFormModel();
  const rows = await Form.findAll({
    where: { status: { [Op.ne]: "archived" } },
    order: [["updated_at", "DESC"]],
  });
  const usageMap = await getFormUsageMap();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    variant: row.variant,
    status: row.status,
    usageCount: usageMap[row.id] || 0,
    updatedAt: row.updatedAt,
  }));
}

async function getFormById(id) {
  const Form = getFormModel();
  const row = await Form.findByPk(id);
  if (!row) return null;
  const usageCount = await getFormUsageCount(id);
  return { ...row.toJSON(), usageCount };
}

async function createForm(payload, actor) {
  const Form = getFormModel();
  const variant = payload.variant || "lead-form";
  const baseSlug = slugify(payload.slug || payload.name);

  if (baseSlug) {
    const existing = await Form.findOne({ where: { slug: baseSlug } });
    if (existing) {
      return updateForm(existing.id, { ...payload, slug: baseSlug }, actor);
    }
  }

  const slug = await ensureUniqueSlug(baseSlug);
  return Form.create({
    id: payload.id || buildFormId(),
    name: payload.name || "Untitled Form",
    slug,
    description: payload.description || null,
    variant,
    status: payload.status || "draft",
    content: payload.content || defaultContentForType(variant),
    createdBy: actor?.sub || null,
    updatedBy: actor?.sub || null,
  });
}

async function updateForm(id, payload, actor) {
  const Form = getFormModel();
  const row = await Form.findByPk(id);
  if (!row) return null;
  if (payload.name !== undefined) row.name = payload.name;
  if (payload.description !== undefined) row.description = payload.description;
  if (payload.variant !== undefined) row.variant = payload.variant;
  if (payload.status !== undefined) row.status = payload.status;
  if (payload.content !== undefined) row.content = payload.content;
  if (payload.slug !== undefined) {
    row.slug = await ensureUniqueSlug(slugify(payload.slug), id);
  }
  row.updatedBy = actor?.sub || row.updatedBy;
  await row.save();
  return getFormById(id);
}

async function duplicateForm(id, actor) {
  const source = await getFormById(id);
  if (!source) return null;
  return createForm(
    {
      name: `${source.name} (Copy)`,
      variant: source.variant,
      content: source.content,
      description: source.description,
    },
    actor,
  );
}

async function publishForm(id, actor) {
  return updateForm(id, { status: "published" }, actor);
}

async function archiveForm(id, actor) {
  return updateForm(id, { status: "archived" }, actor);
}

async function deleteForm(id) {
  const usageCount = await getFormUsageCount(id);
  if (usageCount > 0) {
    return { deleted: false, reason: "IN_USE", usageCount };
  }
  const Form = getFormModel();
  const row = await Form.findByPk(id);
  if (!row) return { deleted: false, reason: "NOT_FOUND" };
  await row.destroy();
  return { deleted: true };
}

module.exports = {
  listForms,
  getFormById,
  createForm,
  updateForm,
  duplicateForm,
  publishForm,
  archiveForm,
  deleteForm,
};
