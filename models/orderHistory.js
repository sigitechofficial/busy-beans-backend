const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const orderHistory = sequelize.define(
    'orderHistory',
    {
      orderStatus: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      discription: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      on: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: sequelize.NOW,
      },
    },
    {
      tableName: 'orderHistories',
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
      indexes: [
        {
          fields: ['orderStatus'],
          name: 'orderHistories_index',
        },
      ],
    },
  );

  return orderHistory;
};
