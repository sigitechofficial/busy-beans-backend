// models/employee.js
const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize) => {
  const employee = sequelize.define(
    "employee",
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: {
            msg: "Employee Name is required",
          },
          notEmpty: {
            msg: "Employee Name cannot be empty",
          },
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          msg: "Email is already taken",
        },
        validate: {
          notNull: {
            msg: "Email is required",
          },
          notEmpty: {
            msg: "Email cannot be empty",
          },
          isEmail: {
            msg: "Please provide a valid email address",
          },
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      employeeOf: {
        type: DataTypes.ENUM("Admin", "Local Partner"),
        allowNull: false,
        defaultValue: "Local Partner",
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      countryCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: "employees",
      paranoid: true,
      timestamps: true,
    }
  );

  const SALT_ROUNDS = 12;

  // Create
  employee.addHook("beforeCreate", (instance) => {
    if (instance.password) {
      instance.password = bcrypt.hashSync(instance.password, SALT_ROUNDS);
    }
  });

  // Update (only if changed)
  employee.addHook("beforeUpdate", (instance) => {
    if (instance.changed("password")) {
      instance.password = bcrypt.hashSync(instance.password, SALT_ROUNDS);
    }
  });

  // If you ever bulk-create users with plaintext passwords:
  employee.addHook("beforeBulkCreate", (instances) => {
    for (const i of instances) {
      if (i.password) {
        i.password = bcrypt.hashSync(i.password, SALT_ROUNDS);
      }
    }
  });

  employee.associate = (models) => {
    employee.hasMany(models.deviceToken);
    models.deviceToken.belongsTo(employee);

    employee.hasMany(models.permission);
    models.permission.belongsTo(employee);

    employee.hasMany(models.user);
    models.user.belongsTo(employee);
  };

  return employee;
};
