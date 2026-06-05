const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

let LandingPageVersionModel = null;

function getLandingPageVersionModel() {
  if (LandingPageVersionModel) return LandingPageVersionModel;

  const sequelize = getMarketingSequelize();
  LandingPageVersionModel = sequelize.define(
    "landing_page_versions",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      landingPageId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: "landing_page_id",
      },
      versionNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "version_number",
      },
      action: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      publishedBy: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "published_by",
      },
      publishedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "published_at",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      snapshotSectionCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "snapshot_section_count",
        defaultValue: 0,
      },
      sectionsSnapshot: {
        type: DataTypes.JSON,
        allowNull: true,
        field: "sections_snapshot",
      },
    },
    {
      tableName: "landing_page_versions",
      freezeTableName: true,
      timestamps: false,
      indexes: [{ fields: ["landing_page_id", "version_number"] }],
    },
  );

  return LandingPageVersionModel;
}

module.exports = { getLandingPageVersionModel };
