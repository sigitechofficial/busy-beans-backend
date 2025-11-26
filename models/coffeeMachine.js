const { DataTypes } = require("sequelize");
module.exports = (sequelize) => {
  const coffeeMachine = sequelize.define(
    "coffeeMachine",
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tag: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      desc: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
      price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0.0,
      },
      pricePer: {
        type: DataTypes.ENUM("week", "month", "year"),
        allowNull: true,
        defaultValue: "month",
      },
      uptoEmployees: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      image: {
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

  return coffeeMachine;
};
