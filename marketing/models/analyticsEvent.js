const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { jsonGetter, jsonSetter } = require("../utils/jsonField");

let AnalyticsEventModel = null;

function getAnalyticsEventModel() {
  if (AnalyticsEventModel) return AnalyticsEventModel;

  const sequelize = getMarketingSequelize();
  AnalyticsEventModel = sequelize.define(
    "marketing_analytics_events",
    {
      id: {
        type: DataTypes.STRING(80),
        allowNull: false,
        primaryKey: true,
      },
      visitorId: {
        type: DataTypes.STRING(64),
        field: "visitor_id",
        allowNull: false,
      },
      sessionId: {
        type: DataTypes.STRING(64),
        field: "session_id",
        allowNull: false,
      },
      eventType: {
        type: DataTypes.STRING(64),
        field: "event_type",
        allowNull: false,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      pageUrl: {
        type: DataTypes.STRING(2000),
        field: "page_url",
        allowNull: true,
      },
      pathname: {
        type: DataTypes.STRING(500),
        allowNull: true,
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
      attribution: {
        type: DataTypes.JSON,
        allowNull: true,
        get: jsonGetter("attribution", {}),
        set: jsonSetter("attribution"),
      },
      firstTouchUtm: {
        type: DataTypes.JSON,
        field: "first_touch_utm",
        allowNull: true,
        get: jsonGetter("firstTouchUtm", {}),
        set: jsonSetter("firstTouchUtm"),
      },
      lastTouchUtm: {
        type: DataTypes.JSON,
        field: "last_touch_utm",
        allowNull: true,
        get: jsonGetter("lastTouchUtm", {}),
        set: jsonSetter("lastTouchUtm"),
      },
      clickIds: {
        type: DataTypes.JSON,
        allowNull: true,
        get: jsonGetter("clickIds", {}),
        set: jsonSetter("clickIds"),
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        get: jsonGetter("metadata", {}),
        set: jsonSetter("metadata"),
      },
    },
    {
      tableName: "marketing_analytics_events",
      freezeTableName: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    },
  );

  return AnalyticsEventModel;
}

module.exports = { getAnalyticsEventModel };
