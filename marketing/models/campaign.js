const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

let CampaignModel = null;

function getCampaignModel() {
  if (CampaignModel) return CampaignModel;

  const sequelize = getMarketingSequelize();
  CampaignModel = sequelize.define(
    "campaigns",
    {
      id: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      campaignType: {
        type: DataTypes.STRING(64),
        field: "campaign_type",
        allowNull: true,
      },
      objective: {
        type: DataTypes.ENUM(
          "awareness",
          "traffic",
          "leads",
          "engagement",
          "conversions",
        ),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("draft", "active", "paused", "completed", "archived"),
        allowNull: false,
        defaultValue: "draft",
      },
      platforms: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      budgetNote: {
        type: DataTypes.TEXT,
        field: "budget_note",
        allowNull: true,
      },
      startDate: {
        type: DataTypes.DATEONLY,
        field: "start_date",
        allowNull: true,
      },
      endDate: {
        type: DataTypes.DATEONLY,
        field: "end_date",
        allowNull: true,
      },
      destinationUrl: {
        type: DataTypes.STRING(1000),
        field: "destination_url",
        allowNull: true,
      },
      linkedLandingPageId: {
        type: DataTypes.STRING(64),
        field: "linked_landing_page_id",
        allowNull: true,
      },
      productId: {
        type: DataTypes.STRING(64),
        field: "product_id",
        allowNull: true,
      },
      creativeNotes: {
        type: DataTypes.TEXT,
        field: "creative_notes",
        allowNull: true,
      },
      utmSourceDefault: {
        type: DataTypes.STRING(64),
        field: "utm_source_default",
        allowNull: true,
      },
    },
    {
      tableName: "campaigns",
      freezeTableName: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );

  return CampaignModel;
}

module.exports = { getCampaignModel };
