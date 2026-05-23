const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const emailLog = sequelize.define("emailLog", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    emailType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment:
        "invoice_sent | invoice_reminder | paid_receipt | paid_receipt_admin | supplier_new_order | order_shipped | order_confirmation",
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Set when orderType is customer",
    },
    partnerOrderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Set when orderType is local-partner",
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
    zeptoRequestId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "ZeptoMail request_id from send response; used for webhooks (opened, clicked, etc.)",
    },
    firstOpenedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "First time email was opened (from Zepto webhook)",
    },
    lastOpenedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Most recent open time (from Zepto webhook)",
    },
    openCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of times email was opened",
    },
    clickCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of times links were clicked",
    },
    softBouncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When soft bounce was reported (from Zepto webhook)",
    },
    softBounceReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Soft bounce reason/diagnostic (from Zepto webhook)",
    },
    retrySuccess: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
      comment:
        "NULL = initial send; true = resend/retry succeeded; false = resend/retry failed",
    },
  });
  return emailLog;
};
