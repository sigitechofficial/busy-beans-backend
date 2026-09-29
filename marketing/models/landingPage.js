const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { jsonGetter, jsonSetter } = require("../utils/jsonField");

let LandingPageModel = null;

function getLandingPageModel() {
  if (LandingPageModel) return LandingPageModel;

  const sequelize = getMarketingSequelize();
  LandingPageModel = sequelize.define(
    "landing_pages",
    {
      id: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(200),
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM("draft", "published", "scheduled", "archived"),
        allowNull: false,
        defaultValue: "draft",
      },
      templateId: {
        type: DataTypes.STRING(64),
        field: "template_id",
        allowNull: true,
      },
      campaignName: {
        type: DataTypes.STRING(255),
        field: "campaign_name",
        allowNull: true,
      },
      objective: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      targetAudience: {
        type: DataTypes.STRING(500),
        field: "target_audience",
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      draftSections: {
        type: DataTypes.JSON,
        field: "draft_sections",
        allowNull: false,
        defaultValue: [],
        get: jsonGetter("draftSections", []),
        set: jsonSetter("draftSections"),
      },
      publishedSections: {
        type: DataTypes.JSON,
        field: "published_sections",
        allowNull: true,
        get: jsonGetter("publishedSections", null),
        set: jsonSetter("publishedSections"),
      },
      seo: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
        get: jsonGetter("seo", {}),
        set: jsonSetter("seo"),
      },
      tracking: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
        get: jsonGetter("tracking", {}),
        set: jsonSetter("tracking"),
      },
      formSettings: {
        type: DataTypes.JSON,
        field: "form_settings",
        allowNull: false,
        defaultValue: {},
        get: jsonGetter("formSettings", {}),
        set: jsonSetter("formSettings"),
      },
      settings: {
        type: DataTypes.JSON,
        allowNull: true,
        get: jsonGetter("settings", {}),
        set: jsonSetter("settings"),
      },
      /** Draft page theme (utils/designSystem.js); copied to publishedDesignSystem on publish. */
      designSystem: {
        type: DataTypes.JSON,
        field: "design_system",
        allowNull: true,
        get: jsonGetter("designSystem", null),
        set: jsonSetter("designSystem"),
      },
      publishedDesignSystem: {
        type: DataTypes.JSON,
        field: "published_design_system",
        allowNull: true,
        get: jsonGetter("publishedDesignSystem", null),
        set: jsonSetter("publishedDesignSystem"),
      },
      previewToken: {
        type: DataTypes.STRING(128),
        field: "preview_token",
        allowNull: false,
      },
      publishedUrl: {
        type: DataTypes.STRING(500),
        field: "published_url",
        allowNull: true,
      },
      publishedAt: {
        type: DataTypes.DATE,
        field: "published_at",
        allowNull: true,
      },
      scheduledAt: {
        type: DataTypes.DATE,
        field: "scheduled_at",
        allowNull: true,
      },
      unpublishAt: {
        type: DataTypes.DATE,
        field: "unpublish_at",
        allowNull: true,
      },
      archivedAt: {
        type: DataTypes.DATE,
        field: "archived_at",
        allowNull: true,
      },
      createdBy: {
        type: DataTypes.STRING(64),
        field: "created_by",
        allowNull: true,
      },
      updatedBy: {
        type: DataTypes.STRING(64),
        field: "updated_by",
        allowNull: true,
      },
    },
    {
      tableName: "landing_pages",
      freezeTableName: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { unique: true, fields: ["slug"] },
        { fields: ["status"] },
        { fields: ["preview_token"] },
      ],
    },
  );

  return LandingPageModel;
}

module.exports = { getLandingPageModel };
