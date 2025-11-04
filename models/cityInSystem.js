const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize) => {
  const cityInSystem = sequelize.define(
    "cityInSystem",
    {
      name: {
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
      indexes: [
        {
          fields: ["name"],
          name: "name_index",
        },
      ],
    }
  );

  // Associations models
  cityInSystem.associate = (models) => {
    cityInSystem.hasMany(models.address);
    models.address.belongsTo(cityInSystem);
  };

  return cityInSystem;
};
