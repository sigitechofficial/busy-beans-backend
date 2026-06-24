const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

let VisitorModel = null;

function getVisitorModel() {
  if (VisitorModel) return VisitorModel;

  const sequelize = getMarketingSequelize();
  VisitorModel = sequelize.define(
    "marketing_visitors",
    {
      visitorId: {
        type: DataTypes.STRING(64),
        field: "visitor_id",
        allowNull: false,
        primaryKey: true,
      },
      firstSeenAt: {
        type: DataTypes.DATE,
        field: "first_seen_at",
        allowNull: false,
      },
      lastSeenAt: {
        type: DataTypes.DATE,
        field: "last_seen_at",
        allowNull: false,
      },
    },
    {
      tableName: "marketing_visitors",
      freezeTableName: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );

  return VisitorModel;
}

module.exports = { getVisitorModel };
