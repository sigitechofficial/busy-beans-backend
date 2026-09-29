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
