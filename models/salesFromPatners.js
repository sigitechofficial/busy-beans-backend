const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize) => {
  const salesFromPatners = sequelize.define(
    "salesFromPatners",
    {
      amount: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: true,
        defaultValue: 0,
      },
      method: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      tableName: "salesFromPatners",
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
    }
  );

  return salesFromPatners;
};
