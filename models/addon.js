const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Addon = sequelize.define(
    "addon",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "addons",
      timestamps: true,
    }
  );

  Addon.associate = (models) => {
    // Many-to-many with Subscription through SubscriptionAddon
    Addon.belongsToMany(models.subscription, {
      through: models.subscriptionAddon,
      foreignKey: "addonId",
      as: "subscriptions",
    });
  };

  return Addon;
};
