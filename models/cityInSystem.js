const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const cityInSystem = sequelize.define(
    'cityInSystem',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          args: true,
          msg: 'City already exist.',
        },
      },
    },
    { 
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
      indexes: [
        {
          fields: ['name'],
          name: 'name_index',
        },
      ],
    },
  );

  // Associations models
  cityInSystem.associate = (models) => {
    cityInSystem.hasMany(models.address);
    models.address.belongsTo(cityInSystem);
  };

  return cityInSystem;
};
