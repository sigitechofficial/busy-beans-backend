// models/LeadLog.js
const { DataTypes } = require("sequelize");
module.exports = (sequelize) => {
  const LeadLog = sequelize.define(
    "LeadLog",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      type: {
        type: DataTypes.ENUM("status", "call", "email", "note"),
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      // userId: {
      //   type: DataTypes.INTEGER,
      //   references: {
      //     model: "Users",
      //     key: "id",
      //   },
      // },
    },
    {
      tableName: "leadLogs",
      timestamps: true,
      updatedAt: false,
    }
  );
  return LeadLog;
};
