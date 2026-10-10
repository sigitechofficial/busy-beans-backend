const { DataTypes } = require("sequelize");

/** Who created / changed / deleted customers, partners, suppliers, sub-admins, employees (utils/auditTrail.js). */
module.exports = (sequelize) => {
  const auditLog = sequelize.define(
    "auditLog",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      /** customer · partner · supplier · subAdmin · employee */
      entityType: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },
      entityId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      /** created · updated · deleted · approved · price_list_changed · discounts_removed … */
      action: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      summary: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      /** JSON: { field: { from, to } } — changed fields only. */
      changes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      actorEntity: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      actorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      actorName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "auditLogs",
      timestamps: true,
      updatedAt: false,
      indexes: [{ fields: ["entityType", "entityId"], name: "audit_logs_entity_idx" }],
    },
  );

  return auditLog;
};
