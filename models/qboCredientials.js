// models/QboToken.js
const { DataTypes } = require("sequelize");
module.exports = (sequelize) => {
  const qboCredientials = sequelize.define("qboCredientials", {
    QBO_CLIENT_ID: { type: DataTypes.TEXT, allowNull: true },
    QBO_CLIENT_SECRET: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.BOOLEAN, allowNull: true },
  });
  return qboCredientials;
};
