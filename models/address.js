module.exports = (sequelize, DataTypes) => {
  const address = sequelize.define(
    'address',
    {
      companyaddress: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          args: true,
          msg: 'This email is already exist.',
        },
      },
      addressLineOne: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      addressLineTwo: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      town: {
        //town
        type: DataTypes.STRING,
        allowNull: false,
      },
      zipCode: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: false,
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
      tableName: 'addresses',
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
      indexes: [
        {
          fields: ['town'],
          name: 'town_index',
        },
      ],
    },
  );

  address.associate = (models) => {
    address.hasMany(models.order);
    models.order.belongsTo(address);
  };

  return address;
};
