const { DataTypes } = require("sequelize");

/** Who did what and when on an order / partner order (utils/orderActivity.js). */
module.exports = (sequelize) => {
  const orderActivityLog = sequelize.define(
    "orderActivityLog",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      orderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      partnerOrderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      /** invoice_edited · invoice_sent · invoice_deleted · order_deleted · status_* · supplier_assigned · marked_paid · cheque_added · cheque_edited · tracking_updated · paid_online */
      action: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      summary: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      /** JSON: before / after values, lines, method, reference. */
      details: {
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
      tableName: "orderActivityLogs",
      timestamps: true,
      updatedAt: false,
      indexes: [
        { fields: ["orderId"], name: "order_activity_order_idx" },
        { fields: ["partnerOrderId"], name: "order_activity_partner_order_idx" },
      ],
    },
  );

  return orderActivityLog;
};
