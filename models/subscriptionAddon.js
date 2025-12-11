const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const SubscriptionAddon = sequelize.define(
    "subscriptionAddon",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      subscriptionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "subscriptions",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      addonId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "addons",
          key: "id",
        },
        onDelete: "CASCADE",
      },
    },
    {
      tableName: "subscriptionAddons",
      timestamps: true,
    }
  );

  // No additional associations needed - this is a junction table
  SubscriptionAddon.associate = (models) => {
    // Associations are handled in Subscription and Addon models
  };

  return SubscriptionAddon;
};
