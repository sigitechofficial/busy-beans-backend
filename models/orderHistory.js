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
          fields: ['orderHistories'],
          name: 'orderHistories_index',
        },
      ],
    },
  );

  return orderHistory;
};
