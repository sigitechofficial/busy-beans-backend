const { DataTypes } = require('sequelize');
 
module.exports = (sequelize) => {
  const transfersToSalesRep = sequelize.define(
    'transfersToSalesRep',
    {
      amount : {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tranferId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
    },
    {
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
    },
  );

  return transfersToSalesRep;
};
