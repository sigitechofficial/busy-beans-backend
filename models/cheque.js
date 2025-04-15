const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const chequeDetail = sequelize.define(
    'chequeDetail',
    {
      chequeNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        // unique: {
        //   msg: 'Cheque already used for another order payment',
        // },
        validate: {
          notNull: {
            msg: 'Cheque number is required',
          },
          notEmpty: {
            msg: 'Cheque number cannot be empty',
          },
        },
      },
      chequeDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      chequeStatus: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bankName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bankBranch: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      chequeType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      chequeReceiptDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
    },
    {
      tableName: 'chequeDetails',
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
      indexes: [
        {
          fields: ['chequeNumber'],
          name: 'checkNumber_index',
        },
        {
          fields: ['bankName'],
          name: 'bankName_index',
        },
      ],
    },
  );

  return chequeDetail;
};
