const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const checkoutBatch = sequelize.define(
    "checkoutBatch",
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      salesRepId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      connectAccountId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      partnerType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      batchContext: {
        type: DataTypes.ENUM("admin", "partner", "direct-partner"),
        allowNull: false,
        defaultValue: "admin",
      },
      stripeSessionId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      paymentIntentId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      hostedInvoiceUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      grandTotal: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: false,
        defaultValue: 0,
      },
      totalAdminReceivable: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: false,
        defaultValue: 0,
      },
      totalPartnerCommission: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: false,
        defaultValue: 0,
      },
      totalStripeFeeEstimate: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM("open", "paid", "expired", "cancelled"),
        allowNull: false,
        defaultValue: "open",
      },
      invoiceNumbers: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      orderIdsSnapshot: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "checkout_batches",
      timestamps: true,
    },
  );

  checkoutBatch.associate = (models) => {
    checkoutBatch.hasMany(models.checkoutBatchOrder, {
      foreignKey: "checkoutBatchId",
      as: "batchOrders",
    });
    checkoutBatch.belongsTo(models.user, {
      foreignKey: "userId",
      as: "customer",
    });
  };

  return checkoutBatch;
};
