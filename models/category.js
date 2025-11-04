module.exports = (sequelize, DataTypes) => {
  const category = sequelize.define(
    'category',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
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
      tableName: 'categories',
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
      indexes: [
        {
          fields: ['name'],
          name: 'name_index',
        },
      ],
    },
  );

  category.associate = (models) => {
    category.hasMany(models.product);
    models.product.belongsTo(category);

    category.hasMany(models.userDiscount);
    models.userDiscount.belongsTo(category);

    category.hasMany(models.item);
    models.item.belongsTo(category);
  };

  return category;
};
