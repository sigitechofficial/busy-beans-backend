const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const item = sequelize.define(
    "item",
    {
      qty: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      productName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      weight: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      unit: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "",
      },
      salerCommission: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      discount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      wholesalePrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      type: {
        type: DataTypes.ENUM("product", "charges"),
        defaultValue: "product",
      },
      // Invoice pricing (utils/invoiceLinePricing.js). `price` stays the line total.
      /** Unit price charged (after discount; the custom price when priceOverride). */
      unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      /** Unit price set by hand ("Edit unit price" permission); kept on later edits. */
      priceOverride: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      /** Catalog unit price (after the customer's discount) when the line was last saved. */
      catalogUnitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
    },
    {
      tableName: "items",
      primaryKey: true,
      autoIncrement: true,
      timestamps: true,
    }
  );

  return item;
};
