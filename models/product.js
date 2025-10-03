module.exports = (sequelize, DataTypes) => {
  const product = sequelize.define(
    "product",
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      weight: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: true,
        defaultValue: 0,
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
      wholesalePrice: {
        type: DataTypes.DECIMAL(20, 2),
        allowNull: true,
        defaultValue: 0,
      },
      desc: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      sku: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      grind: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      productCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
    },
    {
      tableName: "products",
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
      indexes: [
        {
          fields: ["name"],
          name: "name_index",
        },
      ],
    }
  );

  product.associate = (models) => {
    product.hasMany(models.item);
    models.item.belongsTo(product);

    product.hasMany(models.partnerOrderItem);
    models.partnerOrderItem.belongsTo(product);

    product.hasMany(models.skuSupplier);
    models.skuSupplier.belongsTo(product);

    product.hasMany(models.userDiscount);
    models.userDiscount.belongsTo(product);
  };
  return product;
};
