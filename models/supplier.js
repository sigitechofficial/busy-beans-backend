const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize) => {
  const supplier = sequelize.define(
    "supplier",
    {
      supplierName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: {
            msg: "Supplier Name is Required",
          },
          notEmpty: {
            msg: "Supplier Name cannot be empty",
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
      zipCode: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: true,
      },
      countryCode: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: true,
      },
      phoneNum: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: true,
      },
      addressOne: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: true,
      },
      addressTwo: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: true,
      },
      businessWeb: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: true,
      },
      image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      supplierType: {
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
      bankAccount: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      businessRegistrationNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      registerBy: {
        type: DataTypes.ENUM("email", "google", "apple", "facebook"),
        allowNull: false,
        defaultValue: "email",
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
      tableName: "supplier",
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
  supplier.addHook("beforeCreate", (instance) => {
    if (instance.password) {
      instance.password = bcrypt.hashSync(instance.password, SALT_ROUNDS);
    }
  });

  // Update (only if changed)
  supplier.addHook("beforeUpdate", (instance) => {
    if (instance.changed("password")) {
      instance.password = bcrypt.hashSync(instance.password, SALT_ROUNDS);
    }
  });

  // If you ever bulk-create suppliers with plaintext passwords:
  supplier.addHook("beforeBulkCreate", (instances) => {
    for (const i of instances) {
      if (i.password) {
        i.password = bcrypt.hashSync(i.password, SALT_ROUNDS);
      }
    }
  });
  // Associations models
  supplier.associate = (models) => {
    supplier.hasMany(models.order);
    models.order.belongsTo(supplier);

    supplier.hasMany(models.partnerOrder);
    models.partnerOrder.belongsTo(supplier);

    supplier.hasMany(models.deviceToken);
    models.deviceToken.belongsTo(supplier);

    supplier.hasMany(models.skuSupplier);
    models.skuSupplier.belongsTo(supplier);
  };

  return supplier;
};
