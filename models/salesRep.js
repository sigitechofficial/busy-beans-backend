const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const salesRep = sequelize.define(
    'salesRep',
    {
      srName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: {
            msg: 'Sales Resentative Name is Required',
          },
          notEmpty: {
            msg: 'Sales Resentative Name cannot be empty',
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
      territory: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      zipCode: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: true,
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: true,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: true,
      },
      image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      registerDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: sequelize.NOW,
      },
      registerBy: {
        type: DataTypes.ENUM('email', 'google', 'apple', 'facebook'),
        allowNull: false,
        defaultValue: 'email',
      },
      password: {
        type: DataTypes.STRING,
      },
    },
    {
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
  salesRep.addHook('beforeFind', (options) => {
    if (options.attributes) {
      options.attributes.exclude = ['deletedAt', 'updatedAt'];
    }
  });

  // Hook to hash password before create or update
  salesRep.addHook('beforeCreate', async (input) => {
    if (input.password) {
      input.password = await bcrypt.hash(input.password, 6); // Hash the password before saving
    }
  });

  salesRep.addHook('beforeUpdate', async (input) => {
    if (input.password) {
      input.password = await bcrypt.hash(input.password, 6); // Hash the password before saving
    }
  });

  // Associations models
  salesRep.associate = (models) => {
    salesRep.hasMany(models.user);
    models.user.belongsTo(salesRep);
  };

  return salesRep;
};
