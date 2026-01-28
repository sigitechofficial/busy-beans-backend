const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const salesRepProductPrice = sequelize.define(
    "salesRepProductPrice",
    {
      price: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
    },
    {
      tableName: "salesRepProductPrices",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["productId", "salesRepId"],
          name: "unique_product_salesrep",
        },
        {
          fields: ["productId"],
          name: "productId_index",
        },
        {
          fields: ["salesRepId"],
          name: "salesRepId_index",
        },
      ],
    }
  );


  return salesRepProductPrice;
};
