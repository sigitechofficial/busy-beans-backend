const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

let FormModel = null;

function getFormModel() {
  if (FormModel) return FormModel;

  const sequelize = getMarketingSequelize();
  FormModel = sequelize.define(
    "forms",
    {
      id: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(255), allowNull: false },
      slug: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      variant: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: "lead-form",
      },
      status: {
        type: DataTypes.ENUM("draft", "published", "archived"),
        allowNull: false,
        defaultValue: "draft",
      },
      content: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      usageCount: {
        type: DataTypes.INTEGER,
        field: "usage_count",
        allowNull: false,
        defaultValue: 0,
      },
      createdBy: {
        type: DataTypes.STRING(64),
        field: "created_by",
        allowNull: true,
      },
      updatedBy: {
        type: DataTypes.STRING(64),
        field: "updated_by",
        allowNull: true,
      },
    },
    {
      tableName: "marketing_forms",
      freezeTableName: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );

  return FormModel;
}

module.exports = { getFormModel };
