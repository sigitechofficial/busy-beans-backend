module.exports = (sequelize, DataTypes) => {
  const pushNotification = sequelize.define("pushNotification", {
    at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    to: {
      type: DataTypes.ENUM(
        "customer",
        "supplier",
        "localPatner",
        "admin",
        "all"
      ),
      allowNull: false,
      defaultValue: "all",
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    body: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    data: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM("order", "permotional"),
      defaultValue: "order",
    },
    repliedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  return pushNotification;
};
