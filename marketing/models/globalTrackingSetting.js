const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

let GlobalTrackingSettingModel = null;

function getGlobalTrackingSettingModel() {
  if (GlobalTrackingSettingModel) return GlobalTrackingSettingModel;

  const sequelize = getMarketingSequelize();
  GlobalTrackingSettingModel = sequelize.define(
    "global_tracking_settings",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        defaultValue: 1,
      },
      settings: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      updatedBy: {
        type: DataTypes.STRING(255),
        field: "updated_by",
        allowNull: true,
      },
    },
    {
      tableName: "global_tracking_settings",
      freezeTableName: true,
      timestamps: true,
      createdAt: false,
      updatedAt: "updated_at",
    },
  );

  return GlobalTrackingSettingModel;
}

module.exports = { getGlobalTrackingSettingModel };
