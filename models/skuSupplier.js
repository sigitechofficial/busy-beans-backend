const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const skuSupplier = sequelize.define(
    "skuSupplier",
    {
      supplierSku: {
        type: DataTypes.STRING,
        allowNull: false,
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
      indexes: [
        {
          fields: ["supplierSku"],
          name: "supplierSku_index",
        },
      ],
    }
  );

  return skuSupplier;
};
