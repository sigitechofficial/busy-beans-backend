const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize) => {
  const statuses = sequelize.define(
    "statuses",
    {
      orderStatus: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      discription: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
    },
    {
      tableName: "statuses",
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
      indexes: [
        {
          fields: ["orderStatus"],
          name: "orderStatus_index",
        },
      ],
    }
  );

  // Associations models
  statuses.associate = (models) => {
    statuses.hasMany(models.order);
    models.order.belongsTo(statuses);

    statuses.hasMany(models.partnerOrder);
    models.partnerOrder.belongsTo(statuses);

    statuses.hasMany(models.orderHistory);
    models.orderHistory.belongsTo(statuses);
  };

  return statuses;
};
