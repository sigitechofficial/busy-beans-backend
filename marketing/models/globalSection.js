const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

let GlobalSectionModel = null;

function getGlobalSectionModel() {
  if (GlobalSectionModel) return GlobalSectionModel;

  const sequelize = getMarketingSequelize();
  GlobalSectionModel = sequelize.define(
    "global_sections",
    {
      id: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(255), allowNull: false },
      type: { type: DataTypes.STRING(64), allowNull: false },
      status: {
        type: DataTypes.ENUM("active", "draft"),
        allowNull: false,
        defaultValue: "draft",
      },
      content: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "global_sections",
      freezeTableName: true,
      timestamps: true,
      createdAt: false,
      updatedAt: "updated_at",
    },
  );

  return GlobalSectionModel;
}

module.exports = { getGlobalSectionModel };
