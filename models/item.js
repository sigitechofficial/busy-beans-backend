const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const item = sequelize.define(
    'item',
    {
      qty: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      discount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
    },
    {
      tableName: 'items',
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

  return item;
};
