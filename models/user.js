const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const user = sequelize.define(
    'user',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: {
            msg: 'First Name is Required',
          },
          notEmpty: {
            msg: 'First Name cannot be empty',
          },
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          msg: 'User already exists with this email',
        },
        validate: {
          notNull: {
            msg: 'Email is Required',
          },
          notEmpty: {
            msg: 'Email cannot be empty',
          },
          isEmail: {
            msg: 'Please provide a valid email address',
          },
        },
      },
      password: {
        type: DataTypes.STRING,
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
      image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // company Details
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      countryCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      saleTaxNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      emailToSendInvoices: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      dispatchEmail: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      companyName: {
        type: DataTypes.STRING(),
        allowNull: true,
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
      verifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      stripeCustomerId: {
        type: DataTypes.STRING(),
        allowNull: true,
      },
      defaultPaymentMethod: {
        type: DataTypes.STRING(),
        allowNull: true,
      },
      registerBy: {
        type: DataTypes.ENUM('email', 'google', 'apple', 'facebook'),
        allowNull: false,
        defaultValue: 'email',
      },
      createdBy: {
        type: DataTypes.ENUM('registration', 'sales-rep', 'admin'),
        allowNull: false,
        defaultValue: 'registration',
      },
      preferredPaymentMethod: {
        type: DataTypes.STRING(),
        allowNull: true,
      },
      billingAddress: {
        type: DataTypes.STRING(),
        allowNull: true,
      },
      defaultDiscount: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: true,
        defaultValue: 0,
      },
      qboCustomerId: {
        type: DataTypes.STRING(32), // QBO Customer Id
        allowNull: true,
      },
      qboSyncToken: {
        type: DataTypes.STRING(16), // needed for UPDATEs
        allowNull: true,
      },
      qboSyncStatus: {
        type: DataTypes.ENUM('pending', 'synced', 'error'),
        allowNull: false,
        defaultValue: 'pending',
      },
      qboSyncError: {
        type: DataTypes.TEXT, // last error blob (debug)
        allowNull: true,
      },
      qboLastSyncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'users',
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
  // Hide fields in queries
  user.addHook('beforeFind', (options) => {
    if (!options.attributes) options.attributes = {};
    const existing = Array.isArray(options.attributes.exclude)
      ? options.attributes.exclude
      : [];
    options.attributes.exclude = Array.from(
      new Set([...existing, 'deletedAt', 'updatedAt']),
    );
  });

  const SALT_ROUNDS = 12;

  // Create
  user.addHook('beforeCreate', (instance) => {
    if (instance.password) {
      instance.password = bcrypt.hashSync(instance.password, SALT_ROUNDS);
      console.log('🚀 ~  instance.password:', instance.password);
    }
  });

  // Update (only if changed)
  user.addHook('beforeUpdate', (instance) => {
    if (instance.changed('password')) {
      instance.password = bcrypt.hashSync(instance.password, SALT_ROUNDS);
    }
  });

  // If you ever bulk-create users with plaintext passwords:
  user.addHook('beforeBulkCreate', (instances) => {
    for (const i of instances) {
      if (i.password) {
        i.password = bcrypt.hashSync(i.password, SALT_ROUNDS);
      }
    }
  });
  // NOTE: For bulk updates, use { individualHooks: true } so beforeUpdate runs.
  // Associations models
  user.associate = (models) => {
    user.hasMany(models.userDiscount);
    models.userDiscount.belongsTo(user);

    user.hasMany(models.address);
    models.address.belongsTo(user);

    user.hasMany(models.order);
    models.order.belongsTo(user);

    user.hasMany(models.orderFrequency);
    models.orderFrequency.belongsTo(user);

    user.hasMany(models.billingAddress);
    models.billingAddress.belongsTo(user);

    user.hasMany(models.deviceToken);
    models.deviceToken.belongsTo(user);
  };

  return user;
};
