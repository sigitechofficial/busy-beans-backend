const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Subscription = sequelize.define(
    "subscription",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      customerEmail: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: true,
        },
      },
      stripeCustomerId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      stripeSubscriptionId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: false, // Changed to false to allow multiple pending subscriptions
      },
      stripePriceId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      totalPrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      status: {
        type: DataTypes.ENUM(
          "active",
          "canceled",
          "past_due",
          "incomplete",
          "trialing",
          "pending_payment"
        ),
        allowNull: false,
        defaultValue: "pending_payment",
      },
      machineId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "coffeeMachines",
          key: "id",
        },
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      userName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      subscriptionDays: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
      machinePrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      productsTotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      addonsTotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      currentPeriodStart: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      currentPeriodEnd: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      canceledAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "subscriptions",
      timestamps: true,
    }
  );

  Subscription.associate = (models) => {
    // Belongs to coffeeMachine
    Subscription.belongsTo(models.coffeeMachine, {
      foreignKey: "machineId",
      as: "machine",
    });

    // Many-to-many with Addon through SubscriptionAddon
    Subscription.belongsToMany(models.addon, {
      through: models.subscriptionAddon,
      foreignKey: "subscriptionId",
      as: "addons",
    });

    // Many-to-many with Product through SubscriptionProduct
    Subscription.belongsToMany(models.product, {
      through: models.subscriptionProduct,
      foreignKey: "subscriptionId",
      as: "products",
    });
  };

  return Subscription;
};
