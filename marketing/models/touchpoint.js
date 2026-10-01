const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { jsonGetter, jsonSetter } = require("../utils/jsonField");

let TouchpointModel = null;

function getTouchpointModel() {
  if (TouchpointModel) return TouchpointModel;

  const sequelize = getMarketingSequelize();
  TouchpointModel = sequelize.define(
    "marketing_touchpoints",
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
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      source: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "direct",
      },
      medium: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      campaign: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      content: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      term: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      referrer: {
        type: DataTypes.STRING(2000),
        allowNull: false,
        defaultValue: "",
      },
      landingPage: {
        type: DataTypes.STRING(200),
        field: "landing_page",
        allowNull: true,
      },
      landingPageId: {
        type: DataTypes.STRING(64),
        field: "landing_page_id",
        allowNull: true,
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
      pageTitle: {
        type: DataTypes.STRING(500),
        field: "page_title",
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      channel: {
        type: DataTypes.STRING(100),
        field: "channel",
        allowNull: true,
      },
      touch: {
        type: DataTypes.JSON,
        field: "touch",
        allowNull: true,
        get: jsonGetter("touch", null),
        set: jsonSetter("touch"),
      },
      attributionConflict: {
        type: DataTypes.BOOLEAN,
        field: "attribution_conflict",
        allowNull: false,
        defaultValue: false,
      },
      clickIds: {
        type: DataTypes.JSON,
        field: "click_ids",
        allowNull: true,
        get: jsonGetter("clickIds", {}),
        set: jsonSetter("clickIds"),
      },
      isLandingPage: {
        type: DataTypes.BOOLEAN,
        field: "is_landing_page",
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "marketing_touchpoints",
      freezeTableName: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    },
  );

  return TouchpointModel;
}

module.exports = { getTouchpointModel };
