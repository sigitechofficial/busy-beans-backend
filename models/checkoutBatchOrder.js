const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const checkoutBatchOrder = sequelize.define(
    "checkoutBatchOrder",
    {
      checkoutBatchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      invoiceNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lineAmount: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: false,
        defaultValue: 0,
      },
      adminReceivableAmount: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: false,
        defaultValue: 0,
      },
      localPatnerCommission: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: false,
        defaultValue: 0,
      },
      proportionalStripeFeeEstimate: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: false,
        defaultValue: 0,
      },
      proportionalStripeFee: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: true,
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "checkout_batch_orders",
      timestamps: true,
    },
  );

  checkoutBatchOrder.associate = (models) => {
    checkoutBatchOrder.belongsTo(models.checkoutBatch, {
      foreignKey: "checkoutBatchId",
      as: "batch",
    });
    checkoutBatchOrder.belongsTo(models.order, {
      foreignKey: "orderId",
      as: "order",
    });
  };

  return checkoutBatchOrder;
};
