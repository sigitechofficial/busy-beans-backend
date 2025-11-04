const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize) => {
  const countryInSystem = sequelize.define(
    "countryInSystem",
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isoCode: {
        type: DataTypes.STRING,
        allowNull: true,
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
          fields: ["name"],
          name: "name_index",
        },
      ],
    }
  );

  // Associations models
  countryInSystem.associate = (models) => {
    countryInSystem.hasMany(models.address);
    models.address.belongsTo(countryInSystem);

    countryInSystem.hasMany(models.stateInSystem);
    models.stateInSystem.belongsTo(countryInSystem);

    countryInSystem.hasMany(models.cityInSystem);
    models.cityInSystem.belongsTo(countryInSystem);

    countryInSystem.hasMany(models.territory);
    models.territory.belongsTo(countryInSystem);
  };

  return countryInSystem;
};
