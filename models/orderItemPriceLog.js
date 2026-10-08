const { DataTypes } = require("sequelize");

/** Custom unit price changes on customer invoices (who, when, catalog / old / new unit price). */
module.exports = (sequelize) => {
  const orderItemPriceLog = sequelize.define(
    "orderItemPriceLog",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      productName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      qty: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      /** set · changed · reset */
      action: {
        type: DataTypes.STRING(16),
        allowNull: false,
      },
      catalogUnitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      oldUnitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      newUnitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      changedByEntity: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      changedById: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      changedByName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "orderItemPriceLogs",
      timestamps: true,
      updatedAt: false,
      indexes: [{ fields: ["orderId"], name: "order_item_price_logs_order_idx" }],
    },
  );

  return orderItemPriceLog;
};
