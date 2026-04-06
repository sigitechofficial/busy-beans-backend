const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const GetInTouch = sequelize.define(
    "GetInTouch",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      company: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      teamSize: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      preferredDate: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: "Preferred date from form (optional)",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "get_in_touches",
      timestamps: true,
    },
  );

  return GetInTouch;
};
