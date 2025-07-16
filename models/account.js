const bcrypt = require('bcryptjs');
module.exports = (sequelize, DataTypes) => {
  const account = sequelize.define(
    'account',
    {
      name: {
        type: DataTypes.STRING,
        defaultValue: 'Administrator',
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          args: true,
          msg: 'This email is already exist.',
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      latestOtp: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
    },
    {
      tableName: 'accounts',
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
      indexes: [
        {
          fields: ['email'],
          name: 'email_index',
        },
      ],
    },
  );

  // // Hook to hash password before create or update
  // account.addHook('beforeCreate', async (input) => {
  //   if (input.password) {
  //     input.password = await bcrypt.hash(input.password, 6); // Hash the password before saving
  //   }
  // });

  // account.addHook('beforeUpdate', async (input) => {
  //   if (input.password) {
  //     input.password = await bcrypt.hash(input.password, 6); // Hash the password before saving
  //   }
  // });

  return account;
};
