const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const partnerOrderItem = sequelize.define(
    "partnerOrderItem",
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

      discount: {
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
    },
    {
      tableName: "partnerOrderItems",
      primaryKey: true,
      autoIncrement: true,
      timestamps: true,
    }
  );

  return partnerOrderItem;
};
