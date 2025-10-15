// models/employeePermission.js
module.exports = (sequelize, DataTypes) => {
  const employeePermission = sequelize.define(
    "employeePermission",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      employeeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "employees",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      permissionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "permissions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
    },
    {
      tableName: "employee_permissions",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["employeeId", "permissionId"],
        },
      ],
    }
  );

  // Associations
  employeePermission.associate = (models) => {
    models.employeePermission.belongsTo(models.employee, {
      foreignKey: "employeeId",
    });
    models.employeePermission.belongsTo(models.permission, {
      foreignKey: "permissionId",
    });
  };

  return employeePermission;
};
