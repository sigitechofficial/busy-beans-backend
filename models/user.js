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
          msg: 'user already exists with this email',
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
        allowNull: false,
        validate: {
          notNull: {
            msg: 'Password is Required',
          },
          notEmpty: {
            msg: 'Password cannot be empty',
          },
        },
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
      saleTaxNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      emailToSendInvoices: {
        type: DataTypes.STRING,
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

  // Hook to exclude deletedAt and updatedAt from query results
  user.addHook('beforeFind', (options) => {
    if (options.attributes) {
      options.attributes.exclude = ['deletedAt', 'updatedAt'];
    }
  });

  // Hook to hash password before create or update
  user.addHook('beforeCreate', async (input) => {
    if (input.password) {
      input.password = await bcrypt.hash(input.password, 6); // Hash the password before saving
    }
  });

  user.addHook('beforeUpdate', async (input) => {
    if (input.password) {
      input.password = await bcrypt.hash(input.password, 6); // Hash the password before saving
    }
  });

  // Associations models
  user.associate = (models) => {
    user.hasOne(models.address);
    models.address.belongsTo(user);
  };

  return user;
};
