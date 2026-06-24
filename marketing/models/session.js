const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

let SessionModel = null;

function getSessionModel() {
  if (SessionModel) return SessionModel;

  const sequelize = getMarketingSequelize();
  SessionModel = sequelize.define(
    "marketing_sessions",
    {
      sessionId: {
        type: DataTypes.STRING(64),
        field: "session_id",
        allowNull: false,
        primaryKey: true,
      },
      visitorId: {
        type: DataTypes.STRING(64),
        field: "visitor_id",
        allowNull: false,
      },
      startedAt: {
        type: DataTypes.DATE,
        field: "started_at",
        allowNull: false,
      },
      endedAt: {
        type: DataTypes.DATE,
        field: "ended_at",
        allowNull: false,
      },
      landingPageId: {
        type: DataTypes.STRING(64),
        field: "landing_page_id",
        allowNull: true,
      },
      landingPageSlug: {
        type: DataTypes.STRING(200),
        field: "landing_page_slug",
        allowNull: true,
      },
      isLandingPageSession: {
        type: DataTypes.BOOLEAN,
        field: "is_landing_page_session",
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "marketing_sessions",
      freezeTableName: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );

  return SessionModel;
}

module.exports = { getSessionModel };
