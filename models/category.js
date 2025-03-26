module.exports = (sequelize, DataTypes) => {
  const category = sequelize.define(
    'category',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          args: true,
          msg: 'This category is already exist.',
        },
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
  return category;
};
