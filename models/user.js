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

  // // Hook to exclude deletedAt and updatedAt from query results
  // user.addHook('beforeFind', (options) => {
  //   if (options.attributes) {
  //     options.attributes.exclude = ['deletedAt', 'updatedAt'];
  //   }
  // });

  // // Hook to hash password before create or update
  // user.addHook('beforeCreate', async (input) => {
  //   if (input.password) {
  //     console.log("🚀 ~ user.addHook ~ input.password:", input.password)
  //     input.password = await bcrypt.hash(input.password, 6); // Hash the password before saving
  //     console.log("🚀 ~ user.addHook ~ After.password:", input.password)
  //   }
  // });

  // user.addHook('beforeUpdate', async (input) => {
  //   if (input.password) {
  //     console.log("🚀 ~ user.addHook ~ input.password:", input.password)
  //     input.password = await bcrypt.hash(input.password, 6); // Hash the password before saving
  //     console.log("🚀 ~ user.addHook ~ After.password:", input.password)

  //   }
  // });

  // Associations models
  user.associate = (models) => {
    user.hasMany(models.address);
    models.address.belongsTo(user);

    user.hasMany(models.order);
    models.order.belongsTo(user);

    user.hasMany(models.orderFrequency);
    models.orderFrequency.belongsTo(user);

    user.hasMany(models.billingAddress);
    models.billingAddress.belongsTo(user);
  };

  return user;
};
