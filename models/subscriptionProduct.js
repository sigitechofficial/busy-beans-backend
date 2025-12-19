const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const SubscriptionProduct = sequelize.define(
    "subscriptionProduct",
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
      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "products",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      sku: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      unitPrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      totalPrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
    },
    {
      tableName: "subscriptionProducts",
      timestamps: true,
    }
  );

  // No additional associations needed - this is a junction table
  SubscriptionProduct.associate = (models) => {
    // Associations are handled in Subscription and Product models
  };

  return SubscriptionProduct;
};
