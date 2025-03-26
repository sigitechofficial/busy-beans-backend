module.exports = (sequelize, DataTypes) => {
  const product = sequelize.define(
    'product',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          args: true,
          msg: 'This product is already exist.',
        },
      },
      quantity: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      unit: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      image: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: true,
        defaultValue: 0,
      },
      desc: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'products',
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
      indexes: [
        {
          fields: ['product'],
          name: 'product_index',
        },
      ],
    },
  );
  return product;
};
