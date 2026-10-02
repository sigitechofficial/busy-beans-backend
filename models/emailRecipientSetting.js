const { DataTypes } = require("sequelize");

/** Email recipients configured in the admin panel (utils/emailRecipients.js). */
module.exports = (sequelize) => {
  const emailRecipientSetting = sequelize.define(
    "emailRecipientSetting",
    {
      settingKey: {
        type: DataTypes.STRING(64),
        primaryKey: true,
      },
      value: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    { tableName: "email_recipient_settings" },
  );
  return emailRecipientSetting;
};
