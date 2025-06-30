const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const shippingCompanies = sequelize.define(
    'shippingCompanies',
    {
      company: {
        type: DataTypes.STRING,
        allowNull: false,

      },
      weightFrom: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      weightTo: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      charges: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: true,
        defaultValue: 0,
      },
    },
    {
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
      indexes: [
        {
          fields: ['company'],
          name: 'company_index',
        },
      ],
    },
  );

  return shippingCompanies;
};
