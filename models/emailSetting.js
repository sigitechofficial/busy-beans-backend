const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const emailSetting = sequelize.define(
    "emailSetting",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      recipientType: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },
      recipientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "0 = type default; otherwise person id",
      },
      emailType: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "email_settings",
      indexes: [
        {
          unique: true,
          fields: ["recipientType", "recipientId", "emailType"],
          name: "email_settings_type_id_email_unique",
        },
      ],
    },
  );
  return emailSetting;
};
