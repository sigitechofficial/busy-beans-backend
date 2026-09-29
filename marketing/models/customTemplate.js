const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { jsonGetter, jsonSetter } = require("../utils/jsonField");

let CustomTemplateModel = null;

function getCustomTemplateModel() {
  if (CustomTemplateModel) return CustomTemplateModel;

  const sequelize = getMarketingSequelize();
  CustomTemplateModel = sequelize.define(
    "custom_templates",
    {
      id: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      specIndex: {
        type: DataTypes.INTEGER,
        field: "spec_index",
        allowNull: false,
        defaultValue: 0,
      },
      name: { type: DataTypes.STRING(255), allowNull: false },
      category: { type: DataTypes.STRING(128), allowNull: false, defaultValue: "" },
      objective: { type: DataTypes.STRING(255), allowNull: false, defaultValue: "" },
      audience: { type: DataTypes.STRING(255), allowNull: false, defaultValue: "" },
      useCase: { type: DataTypes.TEXT, field: "use_case", allowNull: true },
      mainCta: {
        type: DataTypes.STRING(255),
        field: "main_cta",
        allowNull: false,
        defaultValue: "",
      },
      urlExamples: {
        type: DataTypes.JSON,
        field: "url_examples",
        allowNull: true,
      },
      thumbnailTone: {
        type: DataTypes.STRING(64),
        field: "thumbnail_tone",
        allowNull: false,
        defaultValue: "",
      },
      sectionTypes: {
        type: DataTypes.JSON,
        field: "section_types",
        allowNull: true,
      },
      requiredSectionTypes: {
        type: DataTypes.JSON,
        field: "required_section_types",
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("approved", "draft", "retired"),
        allowNull: false,
        defaultValue: "draft",
      },
      description: { type: DataTypes.TEXT, allowNull: true },
      initialSections: {
        type: DataTypes.JSON,
        field: "initial_sections",
        allowNull: true,
      },
      /** Page theme for pages created from this template (utils/designSystem.js). */
      designSystem: {
        type: DataTypes.JSON,
        field: "design_system",
        allowNull: true,
        get: jsonGetter("designSystem", null),
        set: jsonSetter("designSystem"),
      },
      usageCount: {
        type: DataTypes.INTEGER,
        field: "usage_count",
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "custom_templates",
      freezeTableName: true,
      timestamps: true,
      createdAt: false,
      updatedAt: "updated_at",
    },
  );

  return CustomTemplateModel;
}

module.exports = { getCustomTemplateModel };
