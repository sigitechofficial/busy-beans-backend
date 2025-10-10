module.exports = (sequelize, DataTypes) => {
  const billingAddress = sequelize.define(
    "billingAddress",
    {
      companyaddress: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "",
      },
      addressLineOne: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      addressLineTwo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      town: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      zipCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lat: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lng: {
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
    },
    {
      tableName: "billingAddresses",
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
      indexes: [
        {
          fields: ["town"],
          name: "town_index",
        },
      ],
    }
  );

  return billingAddress;
};
