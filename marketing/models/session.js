const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { jsonGetter, jsonSetter } = require("../utils/jsonField");

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
      /** First page of the session (write-once). */
      entryPathname: {
        type: DataTypes.STRING(500),
        field: "entry_pathname",
        allowNull: true,
      },
      /** Landing page the session started on, if any (write-once) — used for attribution. */
      entryLandingPageSlug: {
        type: DataTypes.STRING(200),
        field: "entry_landing_page_slug",
        allowNull: true,
      },
      lastLandingPageSlug: {
        type: DataTypes.STRING(200),
        field: "last_landing_page_slug",
        allowNull: true,
      },
      pageCount: {
        type: DataTypes.INTEGER,
        field: "page_count",
        allowNull: false,
        defaultValue: 0,
      },
      engagedMs: {
        type: DataTypes.BIGINT,
        field: "engaged_ms",
        allowNull: false,
        defaultValue: 0,
      },
      /** Acquisition touch of the visit (write-once, from its first touchpoint). */
      channel: {
        type: DataTypes.STRING(100),
        field: "channel",
        allowNull: true,
      },
      source: {
        type: DataTypes.STRING(100),
        field: "source",
        allowNull: true,
      },
      medium: {
        type: DataTypes.STRING(100),
        field: "medium",
        allowNull: true,
      },
      campaign: {
        type: DataTypes.STRING(255),
        field: "campaign",
        allowNull: true,
      },
      content: {
        type: DataTypes.STRING(255),
        field: "content",
        allowNull: true,
      },
      term: {
        type: DataTypes.STRING(500),
        field: "term",
        allowNull: true,
      },
      referrer: {
        type: DataTypes.TEXT,
        field: "referrer",
        allowNull: true,
      },
      landingUrl: {
        type: DataTypes.TEXT,
        field: "landing_url",
        allowNull: true,
      },
      touch: {
        type: DataTypes.JSON,
        field: "touch",
        allowNull: true,
        get: jsonGetter("touch", null),
        set: jsonSetter("touch"),
      },
      lastActivityAt: {
        type: DataTypes.DATE,
        field: "last_activity_at",
        allowNull: true,
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
