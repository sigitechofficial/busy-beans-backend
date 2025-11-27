const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const MachineQuery = sequelize.define(
    "MachineQuery",
    { 
      machineId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      companyName: {
        type: DataTypes.STRING,
      },
      addressLineOne: {
        type: DataTypes.STRING,
      },
      addressLineTwo: {
        type: DataTypes.STRING,
      },
      city: {
        type: DataTypes.STRING,
      },
      state: {
        type: DataTypes.STRING,
      },
      country: {
        type: DataTypes.STRING,
      },
      zipCode: {
        type: DataTypes.STRING,
      },
      email: {
        type: DataTypes.STRING,
      },
      countryCode: {
        type: DataTypes.STRING,
      },
      phoneNumber: {
        type: DataTypes.STRING,
      },
    },
    {
      tableName: "machineQueries",
      timestamps: true,
    }
  );

  return MachineQuery;
};
