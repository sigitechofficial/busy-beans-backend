// models/permission.js
module.exports = (sequelize, DataTypes) => {
  const permission = sequelize.define(
    'permission',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // Ensure permission keys are unique (e.g., "order.create")
        validate: {
          notNull: {
            msg: 'Permission key is required',
          },
          notEmpty: {
            msg: 'Permission key cannot be empty',
          },
        },
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'permissions',
      paranoid: true,
      timestamps: true,
    },
  );

  // Associations
  permission.associate = (models) => {
    // Many-to-many relationship between Permissions and Employees
    permission.belongsToMany(models.employee, {
      through: models.employeePermission, // Reference to join table
      foreignKey: 'permissionId',
      otherKey: 'employeeId',
      as: 'employees', // alias for relationship
    });
  };

  return permission;
};
