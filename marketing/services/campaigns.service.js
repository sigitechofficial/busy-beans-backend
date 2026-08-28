const { getCampaignModel } = require("../models/campaign");
const { getProductModel } = require("../models/product");
const { adjustProductCampaignCount } = require("./products.service");

function buildCampaignId() {
  return `cmp-${Date.now()}`;
}

async function listCampaigns() {
  const Campaign = getCampaignModel();
  const Product = getProductModel();
  const rows = await Campaign.findAll({
    where: {},
    order: [["updated_at", "DESC"]],
  });

  const productIds = [...new Set(rows.map((r) => r.productId).filter(Boolean))];
  const products =
    productIds.length > 0
      ? await Product.findAll({ where: { id: productIds }, attributes: ["id", "name"] })
      : [];
  const productNameById = Object.fromEntries(products.map((p) => [p.id, p.name]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    campaignType: row.campaignType,
    objective: row.objective,
    status: row.status,
    platforms: row.platforms || [],
    startDate: row.startDate,
    endDate: row.endDate,
    destinationUrl: row.destinationUrl,
    linkedLandingPageId: row.linkedLandingPageId,
    productId: row.productId,
    productName: row.productId ? productNameById[row.productId] : undefined,
    updatedAt: row.updatedAt,
  }));
}

async function getCampaignById(id) {
  const Campaign = getCampaignModel();
  const row = await Campaign.findByPk(id);
  if (!row) return null;

  let productName;
  if (row.productId) {
    const Product = getProductModel();
    const product = await Product.findByPk(row.productId, { attributes: ["name"] });
    productName = product?.name;
  }

  return {
    ...row.toJSON(),
    productName,
  };
}

async function applyProductCountChange(oldProductId, newProductId) {
  if (oldProductId && oldProductId !== newProductId) {
    await adjustProductCampaignCount(oldProductId, -1);
  }
  if (newProductId && oldProductId !== newProductId) {
    await adjustProductCampaignCount(newProductId, 1);
  }
}

async function findCampaignByName(name) {
  const Campaign = getCampaignModel();
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return null;
  const rows = await Campaign.findAll({ attributes: ["id", "name"] });
  return rows.find((r) => String(r.name || "").trim().toLowerCase() === normalized) || null;
}

async function createCampaign(payload) {
  const Campaign = getCampaignModel();
  const campaignName = String(payload.name || "").trim();
  if (campaignName) {
    const existing = await findCampaignByName(campaignName);
    if (existing) {
      return updateCampaign(existing.id, payload);
    }
  }

  const id = payload.id || buildCampaignId();
  const row = await Campaign.create({
    id,
    name: payload.name || "Untitled Campaign",
    campaignType: payload.campaignType || null,
    objective: payload.objective || null,
    status: payload.status || "draft",
    platforms: payload.platforms || [],
    budgetNote: payload.budgetNote || null,
    startDate: payload.startDate || null,
    endDate: payload.endDate || null,
    destinationUrl: payload.destinationUrl || null,
    linkedLandingPageId: payload.linkedLandingPageId || null,
    productId: payload.productId || null,
    creativeNotes: payload.creativeNotes || null,
    utmSourceDefault: payload.utmSourceDefault || null,
  });

  if (row.productId) {
    await adjustProductCampaignCount(row.productId, 1);
  }

  return getCampaignById(row.id);
}

async function updateCampaign(id, payload) {
  const Campaign = getCampaignModel();
  const row = await Campaign.findByPk(id);
  if (!row) return null;

  const oldProductId = row.productId;

  if (payload.name !== undefined) row.name = payload.name;
  if (payload.campaignType !== undefined) row.campaignType = payload.campaignType;
  if (payload.objective !== undefined) row.objective = payload.objective;
  if (payload.status !== undefined) row.status = payload.status;
  if (payload.platforms !== undefined) row.platforms = payload.platforms;
  if (payload.budgetNote !== undefined) row.budgetNote = payload.budgetNote;
  if (payload.startDate !== undefined) row.startDate = payload.startDate;
  if (payload.endDate !== undefined) row.endDate = payload.endDate;
  if (payload.destinationUrl !== undefined) row.destinationUrl = payload.destinationUrl;
  if (payload.linkedLandingPageId !== undefined) {
    row.linkedLandingPageId = payload.linkedLandingPageId;
  }
  if (payload.productId !== undefined) row.productId = payload.productId;
  if (payload.creativeNotes !== undefined) row.creativeNotes = payload.creativeNotes;
  if (payload.utmSourceDefault !== undefined) row.utmSourceDefault = payload.utmSourceDefault;

  await row.save();
  await applyProductCountChange(oldProductId, row.productId);
  return getCampaignById(id);
}

async function archiveCampaign(id) {
  const Campaign = getCampaignModel();
  const row = await Campaign.findByPk(id);
  if (!row) return null;
  const oldProductId = row.productId;
  row.status = "archived";
  await row.save();
  if (oldProductId) {
    await adjustProductCampaignCount(oldProductId, -1);
  }
  return getCampaignById(id);
}

async function deleteCampaign(id) {
  const Campaign = getCampaignModel();
  const row = await Campaign.findByPk(id);
  if (!row) return { deleted: false, reason: "NOT_FOUND" };

  const productId = row.productId;
  const wasArchived = row.status === "archived";

  await row.destroy();

  if (productId && !wasArchived) {
    await adjustProductCampaignCount(productId, -1);
  }

  return { deleted: true };
}

module.exports = {
  listCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  archiveCampaign,
  deleteCampaign,
};
