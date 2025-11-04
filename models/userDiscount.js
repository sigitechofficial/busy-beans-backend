const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const userDiscount = sequelize.define(
    'userDiscount',
    {
      percentage: {
        type: DataTypes.DECIMAL(20, 2),
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
          fields: ['percentage'],
          name: 'percentage_index',
        },
      ],
    },
  );

  return userDiscount;
};
