const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { jsonGetter, jsonSetter } = require("../utils/jsonField");

let LeadSubmissionModel = null;

function getLeadSubmissionModel() {
  if (LeadSubmissionModel) return LeadSubmissionModel;

  const sequelize = getMarketingSequelize();
  LeadSubmissionModel = sequelize.define(
    "lead_submissions",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
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
      /** Page the lead was submitted on (same key as analytics events; migration 040). */
      pageType: {
        type: DataTypes.STRING(32),
        field: "page_type",
        allowNull: true,
      },
      pageSlug: {
        type: DataTypes.STRING(200),
        field: "page_slug",
        allowNull: true,
      },
      pageUrl: {
        type: DataTypes.STRING(2000),
        field: "page_url",
        allowNull: false,
      },
      fields: {
        type: DataTypes.JSON,
        allowNull: false,
        get: jsonGetter("fields", {}),
        set: jsonSetter("fields"),
      },
      testMode: {
        type: DataTypes.BOOLEAN,
        field: "test_mode",
        allowNull: false,
        defaultValue: false,
      },
      submittedAt: {
        type: DataTypes.DATE,
        field: "submitted_at",
        allowNull: false,
      },
      // Attribution model (migration 036): see services/leadAttribution.service.js.
      clientSubmittedAt: {
        type: DataTypes.DATE,
        field: "client_submitted_at",
        allowNull: true,
      },
      eventId: {
        type: DataTypes.STRING(64),
        field: "event_id",
        allowNull: true,
      },
      formId: {
        type: DataTypes.STRING(100),
        field: "form_id",
        allowNull: true,
      },
      sectionId: {
        type: DataTypes.STRING(100),
        field: "section_id",
        allowNull: true,
      },
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
      sessionTouch: {
        type: DataTypes.JSON,
        field: "session_touch",
        allowNull: true,
        get: jsonGetter("sessionTouch", null),
        set: jsonSetter("sessionTouch"),
      },
      conversionTouch: {
        type: DataTypes.JSON,
        field: "conversion_touch",
        allowNull: true,
        get: jsonGetter("conversionTouch", null),
        set: jsonSetter("conversionTouch"),
      },
      firstTouchSource: {
        type: DataTypes.STRING(100),
        field: "first_touch_source",
        allowNull: true,
      },
      firstTouchMedium: {
        type: DataTypes.STRING(100),
        field: "first_touch_medium",
        allowNull: true,
      },
      firstTouchChannel: {
        type: DataTypes.STRING(100),
        field: "first_touch_channel",
        allowNull: true,
      },
      lastTouchSource: {
        type: DataTypes.STRING(100),
        field: "last_touch_source",
        allowNull: true,
      },
      lastTouchMedium: {
        type: DataTypes.STRING(100),
        field: "last_touch_medium",
        allowNull: true,
      },
      lastTouchChannel: {
        type: DataTypes.STRING(100),
        field: "last_touch_channel",
        allowNull: true,
      },
      lndSource: {
        type: DataTypes.STRING(100),
        field: "lnd_source",
        allowNull: true,
      },
      lndMedium: {
        type: DataTypes.STRING(100),
        field: "lnd_medium",
        allowNull: true,
      },
      lndChannel: {
        type: DataTypes.STRING(100),
        field: "lnd_channel",
        allowNull: true,
      },
      gclid: {
        type: DataTypes.STRING(512),
        field: "gclid",
        allowNull: true,
      },
      gbraid: {
        type: DataTypes.STRING(512),
        field: "gbraid",
        allowNull: true,
      },
      wbraid: {
        type: DataTypes.STRING(512),
        field: "wbraid",
        allowNull: true,
      },
      dclid: {
        type: DataTypes.STRING(512),
        field: "dclid",
        allowNull: true,
      },
      fbclid: {
        type: DataTypes.STRING(512),
        field: "fbclid",
        allowNull: true,
      },
      msclkid: {
        type: DataTypes.STRING(512),
        field: "msclkid",
        allowNull: true,
      },
      ttclid: {
        type: DataTypes.STRING(512),
        field: "ttclid",
        allowNull: true,
      },
      liFatId: {
        type: DataTypes.STRING(512),
        field: "li_fat_id",
        allowNull: true,
      },
      twclid: {
        type: DataTypes.STRING(512),
        field: "twclid",
        allowNull: true,
      },
      clickIds: {
        type: DataTypes.JSON,
        field: "click_ids",
        allowNull: true,
        get: jsonGetter("clickIds", null),
        set: jsonSetter("clickIds"),
      },
      referrerUrl: {
        type: DataTypes.TEXT,
        field: "referrer_url",
        allowNull: true,
      },
      referrerDomain: {
        type: DataTypes.STRING(255),
        field: "referrer_domain",
        allowNull: true,
      },
      firstLandingPage: {
        type: DataTypes.TEXT,
        field: "first_landing_page",
        allowNull: true,
      },
      sessionLandingPage: {
        type: DataTypes.TEXT,
        field: "session_landing_page",
        allowNull: true,
      },
      landingPageUrl: {
        type: DataTypes.TEXT,
        field: "landing_page_url",
        allowNull: true,
      },
      conversionPage: {
        type: DataTypes.TEXT,
        field: "conversion_page",
        allowNull: true,
      },
      rawQuery: {
        type: DataTypes.TEXT,
        field: "raw_query",
        allowNull: true,
      },
      attributionBasis: {
        type: DataTypes.STRING(16),
        field: "attribution_basis",
        allowNull: true,
      },
      attributionConflict: {
        type: DataTypes.BOOLEAN,
        field: "attribution_conflict",
        allowNull: false,
        defaultValue: false,
      },
      visitorId: {
        type: DataTypes.STRING(64),
        field: "visitor_id",
        allowNull: true,
      },
      sessionId: {
        type: DataTypes.STRING(64),
        field: "session_id",
        allowNull: true,
      },
      attribution: {
        type: DataTypes.JSON,
        allowNull: true,
        get: jsonGetter("attribution", {}),
        set: jsonSetter("attribution"),
      },
      device: {
        type: DataTypes.JSON,
        allowNull: true,
        get: jsonGetter("device", {}),
        set: jsonSetter("device"),
      },
      conversionStatus: {
        type: DataTypes.ENUM("new", "contacted", "qualified", "won", "lost"),
        field: "conversion_status",
        allowNull: false,
        defaultValue: "new",
      },
      /** When the lead was marked "won" (a customer); drives won-lead reporting. */
      convertedAt: {
        type: DataTypes.DATE,
        field: "converted_at",
        allowNull: true,
      },
      revenue: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: true,
      },
      profit: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      submitStatus: {
        type: DataTypes.ENUM("success", "failed"),
        field: "submit_status",
        allowNull: false,
        defaultValue: "success",
      },
      ipAddress: {
        type: DataTypes.STRING(64),
        field: "ip_address",
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.TEXT,
        field: "user_agent",
        allowNull: true,
      },
    },
    {
      tableName: "lead_submissions",
      freezeTableName: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["landing_page_id"] },
        { fields: ["submitted_at"] },
        { fields: ["visitor_id"] },
        { fields: ["session_id"] },
      ],
    },
  );

  return LeadSubmissionModel;
}

module.exports = { getLeadSubmissionModel };
