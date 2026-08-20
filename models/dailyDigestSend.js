const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const dailyDigestSend = sequelize.define(
    "dailyDigestSend",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      reportDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: "Business day (America/New_York) the digest covers",
      },
      recipientType: {
        type: DataTypes.ENUM("admin", "partner"),
        allowNull: false,
      },
      recipientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "account.id for admin, salesRep.id for partner",
      },
      status: {
        type: DataTypes.ENUM("pending", "sent", "failed"),
        allowNull: false,
        defaultValue: "pending",
      },
      recipients: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: "Email address(es) used for this send attempt",
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "dailyDigestSends",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["reportDate", "recipientType", "recipientId"],
          name: "uniq_daily_digest_recipient_day",
        },
        {
          fields: ["status"],
          name: "idx_daily_digest_status",
        },
      ],
    },
  );

  return dailyDigestSend;
};
