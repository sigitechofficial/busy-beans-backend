const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const emailLog = sequelize.define(
    "emailLog",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emailType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment:
          "invoice_sent | invoice_reminder | paid_receipt | paid_receipt_admin | supplier_new_order",
      },
      orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      emailSent: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Success",
        comment: "Success | Failed",
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Error details when emailSent is Failed",
      },
      orderType: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: "customer",
        comment: "customer | local-partner",
      },
      recipients: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Comma-separated or JSON array of recipient emails",
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      metadata: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Optional JSON: subject, invoiceNumber, etc.",
      },
    },
     
  );
  return emailLog;
};
