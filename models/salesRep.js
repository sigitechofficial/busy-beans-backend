const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize) => {
  const salesRep = sequelize.define(
    "salesRep",
    {
      srName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: {
            msg: "Sales Resentative Name is Required",
          },
          notEmpty: {
            msg: "Sales Resentative Name cannot be empty",
          },
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          msg: "User already exists with this email",
        },
        validate: {
          notNull: {
            msg: "Email is Required",
          },
          notEmpty: {
            msg: "Email cannot be empty",
          },
          isEmail: {
            msg: "Please provide a valid email address",
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
        defaultValue: new Date(),
      },
      registerBy: {
        type: DataTypes.ENUM("email", "google", "apple", "facebook"),
        allowNull: false,
        defaultValue: "email",
      },
      partnerType: {
        type: DataTypes.ENUM("direct-partner", "dropship-partner"),
        allowNull: false,
        defaultValue: "dropship-partner",
      },
      connectAccountId: {
        type: DataTypes.STRING(),
        allowNull: true,
      },
      stripeCustomerId: {
        type: DataTypes.STRING(),
        allowNull: true,
      },
      defaultBankAccount: {
        type: DataTypes.STRING(),
        allowNull: true,
      },
      isAccountConnected: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      creditLimit: {
        type: DataTypes.INTEGER,
        defaultValue: 2000,
      },
      password: {
        type: DataTypes.STRING,
      },
      latestOtp: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
      indexes: [
        {
          fields: ["email"],
          name: "email_index",
        },
      ],
    }
  );

  const SALT_ROUNDS = 12;

  // Create
  salesRep.addHook("beforeCreate", (instance) => {
    if (instance.password) {
      instance.password = bcrypt.hashSync(instance.password, SALT_ROUNDS);
    }
  });

  // Update (only if changed)
  salesRep.addHook("beforeUpdate", (instance) => {
    if (instance.changed("password")) {
      instance.password = bcrypt.hashSync(instance.password, SALT_ROUNDS);
    }
  });

  // If you ever bulk-create users with plaintext passwords:
  salesRep.addHook("beforeBulkCreate", (instances) => {
    for (const i of instances) {
      if (i.password) {
        i.password = bcrypt.hashSync(i.password, SALT_ROUNDS);
      }
    }
  });

  // Associations models
  salesRep.associate = (models) => {
    salesRep.hasMany(models.user);
    models.user.belongsTo(salesRep);

    salesRep.hasMany(models.orderFrequency);
    models.orderFrequency.belongsTo(salesRep);

    salesRep.hasMany(models.order);
    models.order.belongsTo(salesRep);

    salesRep.hasMany(models.partnerOrder);
    models.partnerOrder.belongsTo(salesRep);

    salesRep.hasMany(models.salesFromPatners);
    models.salesFromPatners.belongsTo(salesRep);

    salesRep.hasOne(models.transfersToSalesRep);
    models.transfersToSalesRep.belongsTo(salesRep);

    salesRep.hasOne(models.stateInSystem);
    models.stateInSystem.belongsTo(salesRep);

    salesRep.hasMany(models.deviceToken);
    models.deviceToken.belongsTo(salesRep);

    salesRep.hasMany(models.employee);
    models.employee.belongsTo(salesRep);

    salesRep.hasMany(models.billingAddress);
    models.billingAddress.belongsTo(salesRep);

    salesRep.hasMany(models.address);
    models.address.belongsTo(salesRep);
  };

  return salesRep;
};
