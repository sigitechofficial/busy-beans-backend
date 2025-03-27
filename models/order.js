const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const order = sequelize.define(
    'order',
    {
      totalBill: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: true,
        defaultValue: 0,
      },
      subTotal: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: true,
        defaultValue: 0,
      },
      discountPrice: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: true,
        defaultValue: 0,
      },
      discountPercentage: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      itemsPrice: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: true,
        defaultValue: 0,
      },
      vat: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: true,
        defaultValue: 0,
      },
      totalWeight: {
        type: DataTypes.DECIMAL(10, 1),
        allowNull: true,
        defaultValue: true,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // company Details
      paymentMethod: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      poNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      orderFrequency: {
        type: DataTypes.ENUM(
          'just-onces',
          'weekly',
          'every-two-weeks',
          'every-four-weeks',
        ),
        allowNull: false,
        defaultValue: 'just-onces',
      },
    },
    {
      tableName: 'orders',
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
    },
  );

  // Hook to exclude deletedAt and updatedAt from query results
  // user.addHook('beforeFind', (options) => {
  //   if (options.attributes) {
  //     options.attributes.exclude = ['deletedAt', 'updatedAt'];
  //   }
  // });

  // // Hook to hash password before create or update
  // user.addHook('beforeCreate', async (input) => {
  //   if (input.password) {
  //     input.password = await bcrypt.hash(input.password, 6); // Hash the password before saving
  //   }
  // });

  // user.addHook('beforeUpdate', async (input) => {
  //   if (input.password) {
  //     input.password = await bcrypt.hash(input.password, 6); // Hash the password before saving
  //   }
  // });

  // Associations models
  order.associate = (models) => {
    order.hasOne(models.item);
    models.item.belongsTo(order);
  };

  return order;
};
