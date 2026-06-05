const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

let MarketingUserModel = null;

function getMarketingUserModel() {
  if (MarketingUserModel) return MarketingUserModel;

  const sequelize = getMarketingSequelize();
  MarketingUserModel = sequelize.define(
    "marketing_users",
    {
      id: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      role: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: "Super Admin",
      },
    },
    {
      tableName: "marketing_users",
      freezeTableName: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [{ unique: true, fields: ["email"] }],
    },
  );

  return MarketingUserModel;
}

module.exports = { getMarketingUserModel };
