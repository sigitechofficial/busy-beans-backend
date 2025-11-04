const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const orderFrequency = sequelize.define(
    "orderFrequency",
    {
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
      orderDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      nextOrderDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      visibilityDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      frequency: {
        type: DataTypes.ENUM(
          "just-onces",
          "weekly",
          "every-two-weeks",
          "every-four-weeks"
        ),
        allowNull: true,
        defaultValue: "just-onces",
      },
    },
    {
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
      indexes: [
        {
          fields: ["frequency"],
          name: "frequency_index",
        },
      ],
    }
  );

  // Associations models
  orderFrequency.associate = (models) => {
    orderFrequency.hasMany(models.order);
    models.order.belongsTo(orderFrequency);

    orderFrequency.hasMany(models.item);
    models.item.belongsTo(orderFrequency);
  };

  return orderFrequency;
};
