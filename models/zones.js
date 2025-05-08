const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const zone = sequelize.define(
    'zone',
    {
    name: {
        type:DataTypes.STRING,
      allowNull:false
    },
    
    coordinates: DataTypes.GEOMETRY('POLYGON'),
    
    status: {
        type:DataTypes.BOOLEAN,
      defaultValue:false
    },
   
  },
    {
      tableName: 'zone',
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
  zone.associate = (models) => {
    zone.hasMany(models.order);
    models.order.belongsTo(zone);
  };

  return zone;
};
