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
      country: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      territoryName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      zipCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      countryCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      supportEmail: {
        type: DataTypes.STRING,
        allowNull: true,
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

  account.associate = (models) => {
    account.hasMany(models.deviceToken);
    models.deviceToken.belongsTo(account);

    account.hasMany(models.employee);
    models.employee.belongsTo(account);
  };

  const SALT_ROUNDS = 12;
  // Create
  account.addHook('beforeCreate', (instance) => {
    if (instance.password) {
      instance.password = bcrypt.hashSync(instance.password, SALT_ROUNDS);
    }
  });

  // Update (only if changed)
  account.addHook('beforeUpdate', (instance) => {
    if (instance.changed('password')) {
      instance.password = bcrypt.hashSync(instance.password, SALT_ROUNDS);
    }
  });

  // If you ever bulk-create users with plaintext passwords:
  account.addHook('beforeBulkCreate', (instances) => {
    for (const i of instances) {
      if (i.password) {
        i.password = bcrypt.hashSync(i.password, SALT_ROUNDS);
      }
    }
  });

  return account;
};
