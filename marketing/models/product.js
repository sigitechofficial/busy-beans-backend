const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

let ProductModel = null;

function getProductModel() {
  if (ProductModel) return ProductModel;

  const sequelize = getMarketingSequelize();
  ProductModel = sequelize.define(
    "products",
    {
      id: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(255), allowNull: false },
      slug: { type: DataTypes.STRING(200), allowNull: false },
      brand: { type: DataTypes.STRING(255), allowNull: false, defaultValue: "" },
      category: {
        type: DataTypes.ENUM(
          "bean-to-cup",
          "espresso",
          "commercial",
          "hospitality",
          "office",
        ),
        allowNull: false,
        defaultValue: "office",
      },
      shortDescription: {
        type: DataTypes.TEXT,
        field: "short_description",
        allowNull: false,
      },
      features: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      imageMediaId: {
        type: DataTypes.STRING(64),
        field: "image_media_id",
        allowNull: true,
      },
      demoLandingSlug: {
        type: DataTypes.STRING(200),
        field: "demo_landing_slug",
        allowNull: true,
      },
      recommendedCampaignTypes: {
        type: DataTypes.JSON,
        field: "recommended_campaign_types",
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("active", "draft", "archived"),
        allowNull: false,
        defaultValue: "active",
      },
      campaignCount: {
        type: DataTypes.INTEGER,
        field: "campaign_count",
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "marketing_products",
      freezeTableName: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );

  return ProductModel;
}

module.exports = { getProductModel };
