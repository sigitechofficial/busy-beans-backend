const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const subAdmin = sequelize.define(
    "subAdmin",
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: { msg: "Sub-admin name is required" },
          notEmpty: { msg: "Sub-admin name cannot be empty" },
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: { msg: "Email is already taken" },
        validate: {
          notNull: { msg: "Email is required" },
          notEmpty: { msg: "Email cannot be empty" },
          isEmail: { msg: "Please provide a valid email address" },
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
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
      verificationRequired: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      verificationContext: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      verificationOtp: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      verificationOtpExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      loginVerificationDone: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "subAdmins",
      paranoid: true,
      timestamps: true,
    },
  );

  const SALT_ROUNDS = 12;

  subAdmin.addHook("beforeCreate", (instance) => {
    if (instance.password) {
      instance.password = bcrypt.hashSync(instance.password, SALT_ROUNDS);
    }
  });

  subAdmin.addHook("beforeUpdate", (instance) => {
    if (instance.changed("password")) {
      instance.password = bcrypt.hashSync(instance.password, SALT_ROUNDS);
    }
  });

  subAdmin.addHook("beforeBulkCreate", (instances) => {
    for (const i of instances) {
      if (i.password) {
        i.password = bcrypt.hashSync(i.password, SALT_ROUNDS);
      }
    }
  });

  subAdmin.associate = (models) => {
    subAdmin.hasMany(models.permission);
    models.permission.belongsTo(models.subAdmin);
  };

  return subAdmin;
};
