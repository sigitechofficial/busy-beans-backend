const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

let SectionCatalogOverrideModel = null;

function getSectionCatalogOverrideModel() {
  if (SectionCatalogOverrideModel) return SectionCatalogOverrideModel;

  const sequelize = getMarketingSequelize();
  SectionCatalogOverrideModel = sequelize.define(
    "section_catalog_overrides",
    {
      sectionType: {
        type: DataTypes.STRING(64),
        field: "section_type",
        allowNull: false,
        primaryKey: true,
      },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      label: { type: DataTypes.STRING(255), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      defaultContent: {
        type: DataTypes.JSON,
        field: "default_content",
        allowNull: true,
      },
    },
    {
      tableName: "section_catalog_overrides",
      freezeTableName: true,
      timestamps: true,
      createdAt: false,
      updatedAt: "updated_at",
    },
  );

  return SectionCatalogOverrideModel;
}

module.exports = { getSectionCatalogOverrideModel };
