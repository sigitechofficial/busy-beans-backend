const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { jsonGetter, jsonSetter } = require("../utils/jsonField");

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
      /** Server-normalized touches (utils/attribution.js); click IDs keep their click time. */
      firstTouch: {
        type: DataTypes.JSON,
        field: "first_touch",
        allowNull: true,
        get: jsonGetter("firstTouch", null),
        set: jsonSetter("firstTouch"),
      },
      lastTouch: {
        type: DataTypes.JSON,
        field: "last_touch",
        allowNull: true,
        get: jsonGetter("lastTouch", null),
        set: jsonSetter("lastTouch"),
      },
      lastNonDirectTouch: {
        type: DataTypes.JSON,
        field: "last_non_direct_touch",
        allowNull: true,
        get: jsonGetter("lastNonDirectTouch", null),
        set: jsonSetter("lastNonDirectTouch"),
      },
      clickIds: {
        type: DataTypes.JSON,
        field: "click_ids",
        allowNull: true,
        get: jsonGetter("clickIds", null),
        set: jsonSetter("clickIds"),
      },
      firstTouchChannel: {
        type: DataTypes.STRING(100),
        field: "first_touch_channel",
        allowNull: true,
      },
      firstTouchSource: {
        type: DataTypes.STRING(100),
        field: "first_touch_source",
        allowNull: true,
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
