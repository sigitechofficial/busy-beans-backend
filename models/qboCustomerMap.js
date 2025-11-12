// models/qboCustomerMap.js
module.exports = (sequelize, DataTypes) => {
  const qboCustomerMap = sequelize.define("qboCustomerMap", {
    qboCustomerId: { type: DataTypes.STRING, allowNull: true },
    realmId: { type: DataTypes.STRING, allowNull: true },
  });
  return qboCustomerMap;
};
