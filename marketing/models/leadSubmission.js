const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

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
      pageUrl: {
        type: DataTypes.STRING(2000),
        field: "page_url",
        allowNull: false,
      },
      fields: {
        type: DataTypes.JSON,
        allowNull: false,
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
      timestamps: false,
      indexes: [{ fields: ["landing_page_id"] }, { fields: ["submitted_at"] }],
    },
  );

  return LeadSubmissionModel;
}

module.exports = { getLeadSubmissionModel };
