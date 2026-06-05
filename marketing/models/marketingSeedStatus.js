const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

let MarketingSeedStatusModel = null;

function getMarketingSeedStatusModel() {
  if (MarketingSeedStatusModel) return MarketingSeedStatusModel;

  const sequelize = getMarketingSequelize();
  MarketingSeedStatusModel = sequelize.define(
    "marketing_seed_status",
    {
      moduleKey: {
        type: DataTypes.STRING(64),
        field: "module_key",
        allowNull: false,
        primaryKey: true,
      },
      seeded: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      completeness: {
        type: DataTypes.ENUM("full", "partial", "empty"),
        allowNull: false,
        defaultValue: "empty",
      },
      recordCount: {
        type: DataTypes.INTEGER,
        field: "record_count",
        allowNull: false,
        defaultValue: 0,
      },
      expectedCount: {
        type: DataTypes.INTEGER,
        field: "expected_count",
        allowNull: false,
        defaultValue: 0,
      },
      syncedAt: {
        type: DataTypes.DATE,
        field: "synced_at",
        allowNull: true,
      },
      syncedBy: {
        type: DataTypes.STRING(255),
        field: "synced_by",
        allowNull: true,
      },
    },
    {
      tableName: "marketing_seed_status",
      freezeTableName: true,
      timestamps: true,
      createdAt: false,
      updatedAt: "updated_at",
    },
  );

  return MarketingSeedStatusModel;
}

module.exports = { getMarketingSeedStatusModel };
