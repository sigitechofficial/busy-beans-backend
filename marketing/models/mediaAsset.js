const { DataTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");

let MediaAssetModel = null;

function getMediaAssetModel() {
  if (MediaAssetModel) return MediaAssetModel;

  const sequelize = getMarketingSequelize();
  MediaAssetModel = sequelize.define(
    "media_assets",
    {
      id: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM("image", "video", "document"),
        allowNull: false,
      },
      altText: {
        type: DataTypes.STRING(500),
        field: "alt_text",
        allowNull: true,
      },
      url: {
        type: DataTypes.STRING(2000),
        allowNull: false,
      },
      mimeType: {
        type: DataTypes.STRING(128),
        field: "mime_type",
        allowNull: true,
      },
      fileSizeBytes: {
        type: DataTypes.INTEGER,
        field: "file_size_bytes",
        allowNull: true,
      },
      approved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      isBuiltin: {
        type: DataTypes.BOOLEAN,
        field: "is_builtin",
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "media_assets",
      freezeTableName: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );

  return MediaAssetModel;
}

module.exports = { getMediaAssetModel };
