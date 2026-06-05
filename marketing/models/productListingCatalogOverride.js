const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

let ProductListingCatalogOverrideModel = null;

function getProductListingCatalogOverrideModel() {
  if (ProductListingCatalogOverrideModel) return ProductListingCatalogOverrideModel;

  const sequelize = getMarketingSequelize();
  ProductListingCatalogOverrideModel = sequelize.define(
    "product_listing_catalog_overrides",
    {
      listingType: {
        type: DataTypes.STRING(64),
        field: "listing_type",
        allowNull: false,
        primaryKey: true,
      },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      label: { type: DataTypes.STRING(255), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "product_listing_catalog_overrides",
      freezeTableName: true,
      timestamps: true,
      createdAt: false,
      updatedAt: "updated_at",
    },
  );

  return ProductListingCatalogOverrideModel;
}

module.exports = { getProductListingCatalogOverrideModel };
