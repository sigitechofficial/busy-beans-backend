const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize) => {
  const stateInSystem = sequelize.define(
    "stateInSystem",
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
  stateInSystem.associate = (models) => {
    stateInSystem.hasMany(models.cityInSystem);
    models.cityInSystem.belongsTo(stateInSystem);

    stateInSystem.hasMany(models.territory);
    models.territory.belongsTo(stateInSystem);

    stateInSystem.hasMany(models.address);
    models.address.belongsTo(stateInSystem);
  };

  return stateInSystem;
};
