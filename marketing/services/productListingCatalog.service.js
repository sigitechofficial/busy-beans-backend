const { getProductListingCatalogOverrideModel } = require("../models/productListingCatalogOverride");

function toRecord(row) {
  return {
    active: Boolean(row.active),
    label: row.label,
    description: row.description,
    updatedAt: row.updatedAt,
  };
}

async function listOverrides() {
  const Model = getProductListingCatalogOverrideModel();
  const rows = await Model.findAll();
  const record = {};
  rows.forEach((row) => {
    record[row.listingType] = toRecord(row);
  });
  return record;
}

async function upsertOverride(listingType, payload) {
  const Model = getProductListingCatalogOverrideModel();
  let row = await Model.findByPk(listingType);
  if (!row) {
    row = await Model.create({
      listingType,
      active: payload.active !== undefined ? payload.active : true,
      label: payload.label || null,
      description: payload.description || null,
    });
  } else {
    if (payload.active !== undefined) row.active = payload.active;
    if (payload.label !== undefined) row.label = payload.label;
    if (payload.description !== undefined) row.description = payload.description;
    await row.save();
  }
  return { listingType: row.listingType, ...toRecord(row) };
}

async function deleteOverride(listingType) {
  const Model = getProductListingCatalogOverrideModel();
  const row = await Model.findByPk(listingType);
  if (!row) return false;
  await row.destroy();
  return true;
}

module.exports = {
  listOverrides,
  upsertOverride,
  deleteOverride,
};
