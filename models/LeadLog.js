// models/LeadLog.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const LeadLog = sequelize.define(
    "LeadLog",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      LeadId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "leads",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      // Entity tracking - who performed the action
      entityType: {
        type: DataTypes.ENUM(
          "admin",
          "supplier",
          "localPartner",
          "adminEmployee",
          "partnerEmployee"
        ),
        allowNull: true,
        comment: "Type of entity that performed the action",
      },
      entityId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment:
          "ID of the entity (accountId, supplierId, salesRepId, employeeId)",
      },
      entityName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: "Name of the entity who performed the action",
      },
      // Action details
      action: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment:
          "Type of action: created, updated, assigned, status_changed, comment, etc.",
      },
      details: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Full description to display in lead timeline/logs",
      },
      // Legacy fields for backward compatibility
      type: {
        type: DataTypes.ENUM(
          "status",
          "update",
          "comment",
          "email",
          "assignment",
          "note"
        ),
        allowNull: true,
        defaultValue: "update",
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      stageNote: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "leadLogs",
      timestamps: true,
      indexes: [
        {
          fields: ["LeadId"],
          name: "leadId_index",
        },
        {
          fields: ["entityType", "entityId"],
          name: "entity_index",
        },
      ],
    }
  );

  LeadLog.associate = (models) => {
    // Association is defined in Lead model
  };

  return LeadLog;
};
