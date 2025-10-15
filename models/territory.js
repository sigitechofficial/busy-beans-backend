const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize) => {
  const territory = sequelize.define(
    "territory",
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

  territory.associate = (models) => {
    territory.hasMany(models.cityInSystem);
    models.cityInSystem.belongsTo(territory);

    territory.hasMany(models.address);
    models.address.belongsTo(territory);
  };

  return territory;
};
