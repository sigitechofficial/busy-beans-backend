const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

let BuiltinTemplateOverrideModel = null;

function getBuiltinTemplateOverrideModel() {
  if (BuiltinTemplateOverrideModel) return BuiltinTemplateOverrideModel;

  const sequelize = getMarketingSequelize();
  BuiltinTemplateOverrideModel = sequelize.define(
    "builtin_template_overrides",
    {
      templateId: {
        type: DataTypes.STRING(64),
        field: "template_id",
        allowNull: false,
        primaryKey: true,
      },
      initialSections: {
        type: DataTypes.JSON,
        field: "initial_sections",
        allowNull: true,
      },
    },
    {
      tableName: "builtin_template_overrides",
      freezeTableName: true,
      timestamps: true,
      createdAt: false,
      updatedAt: "updated_at",
    },
  );

  return BuiltinTemplateOverrideModel;
}

module.exports = { getBuiltinTemplateOverrideModel };
