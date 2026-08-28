const { Op } = require("sequelize");
const { getProductModel } = require("../models/product");
const { getCampaignModel } = require("../models/campaign");

function buildProductId() {
  return `prod-${Date.now()}`;
}

function slugify(name) {
  return String(name || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

async function ensureUniqueSlug(baseSlug, excludeId) {
  const Product = getProductModel();
  let candidate = baseSlug;
  let count = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await Product.findOne({
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

async function listProducts() {
  const Product = getProductModel();
  const rows = await Product.findAll({
    where: { status: { [Op.ne]: "archived" } },
    order: [["updated_at", "DESC"]],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    category: row.category,
    status: row.status,
    campaignCount: row.campaignCount,
    shortDescription: row.shortDescription,
    updatedAt: row.updatedAt,
  }));
}

async function getProductById(id) {
  const Product = getProductModel();
  return Product.findByPk(id);
}

async function getProductBySlug(slug) {
  const Product = getProductModel();
  const normalized = slugify(slug);
  if (!normalized) return null;
  return Product.findOne({ where: { slug: normalized } });
}

async function createProduct(payload) {
  const Product = getProductModel();
  const baseSlug = slugify(payload.slug || payload.name);

  if (baseSlug) {
    const existing = await Product.findOne({ where: { slug: baseSlug } });
    if (existing) {
      return updateProduct(existing.id, { ...payload, slug: baseSlug });
    }
  }

  const slug = await ensureUniqueSlug(baseSlug);
  const id = payload.id || buildProductId();

  return Product.create({
    id,
    name: payload.name || "Untitled Product",
    slug,
    brand: payload.brand || "",
    category: payload.category || "office",
    shortDescription: payload.shortDescription || "",
    features: payload.features || [],
    imageMediaId: payload.imageMediaId || null,
    demoLandingSlug: payload.demoLandingSlug || null,
    recommendedCampaignTypes: payload.recommendedCampaignTypes || [],
    status: payload.status || "active",
    campaignCount: 0,
  });
}

async function updateProduct(id, payload) {
  const Product = getProductModel();
  const row = await Product.findByPk(id);
  if (!row) return null;

  if (payload.name !== undefined) row.name = payload.name;
  if (payload.brand !== undefined) row.brand = payload.brand;
  if (payload.category !== undefined) row.category = payload.category;
  if (payload.shortDescription !== undefined) row.shortDescription = payload.shortDescription;
  if (payload.features !== undefined) row.features = payload.features;
  if (payload.imageMediaId !== undefined) row.imageMediaId = payload.imageMediaId;
  if (payload.demoLandingSlug !== undefined) row.demoLandingSlug = payload.demoLandingSlug;
  if (payload.recommendedCampaignTypes !== undefined) {
    row.recommendedCampaignTypes = payload.recommendedCampaignTypes;
  }
  if (payload.status !== undefined) row.status = payload.status;
  if (payload.slug !== undefined) {
    row.slug = await ensureUniqueSlug(slugify(payload.slug), id);
  }

  await row.save();
  return row;
}

async function archiveProduct(id) {
  const Product = getProductModel();
  const row = await Product.findByPk(id);
  if (!row) return null;
  row.status = "archived";
  await row.save();
  return row;
}

async function deleteProduct(id) {
  const Product = getProductModel();
  const row = await Product.findByPk(id);
  if (!row) return { deleted: false, reason: "NOT_FOUND" };
  if (row.campaignCount > 0) {
    return { deleted: false, reason: "IN_USE", campaignCount: row.campaignCount };
  }
  await row.destroy();
  return { deleted: true };
}

async function adjustProductCampaignCount(productId, delta) {
  if (!productId || !delta) return;
  const Product = getProductModel();
  const row = await Product.findByPk(productId);
  if (!row) return;
  row.campaignCount = Math.max(0, (row.campaignCount || 0) + delta);
  await row.save();
}

module.exports = {
  listProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  archiveProduct,
  deleteProduct,
  adjustProductCampaignCount,
};
