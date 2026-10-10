/**
 * Invoice exception lists (utils/invoiceExceptionFilter.js), checked against the database:
 * "Shipped not invoiced" = shipped / delivered, no invoice date, and NOT paid (paid orders can't be
 * invoiced afterwards); "Overdue shipped" unchanged. Customer and partner orders.
 *
 *   node scripts/invoiceExceptionFilterTest.js        (database only, read-only)
 */
require("dotenv").config();
const { order, partnerOrder, sequelize } = require("../models");
const { invoiceExceptionWhere } = require("../utils/invoiceExceptionFilter");

const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
};
const count = async (table, extra) =>
  Number(
    (
      await sequelize.query(
        `SELECT COUNT(*) n FROM ${table} WHERE deleted = 0 AND statusId IN (4, 5) AND invoiceDate IS NULL ${extra}`,
      )
    )[0][0].n,
  );

(async () => {
  for (const [Model, table, alias] of [
    [order, "orders", "order"],
    [partnerOrder, "partnerOrders", "partnerOrder"],
  ]) {
    const listed = await Model.count({ where: invoiceExceptionWhere("shippedNotInvoiced", alias) });
    const unpaid = await count(table, "AND (paymentStatus IS NULL OR paymentStatus <> 'done')");
    check(listed === unpaid, `${table}: shipped not invoiced lists only unpaid orders (got ${listed}, expected ${unpaid})`);
    const paidListed = await Model.count({
      where: { [sequelize.Sequelize.Op.and]: [invoiceExceptionWhere("shippedNotInvoiced", alias), { paymentStatus: "done" }] },
    });
    check(paidListed === 0, `${table}: no paid order in shipped not invoiced (got ${paidListed})`);
    // Extra filters from the caller (e.g. owner) are kept.
    const scoped = await Model.count({ where: invoiceExceptionWhere("shippedNotInvoiced", alias, { salesRepId: null }) });
    const scopedSql = await count(table, "AND salesRepId IS NULL AND (paymentStatus IS NULL OR paymentStatus <> 'done')");
    check(scoped === scopedSql, `${table}: caller filters still apply (got ${scoped}, expected ${scopedSql})`);
  }
  const overdue = await order.count({ where: invoiceExceptionWhere("overdueShipped", "order") });
  const overdueSql = Number(
    (
      await sequelize.query(
        "SELECT COUNT(*) n FROM orders WHERE deleted = 0 AND statusId IN (4, 5) AND paymentStatus = 'pending' AND invoiceDate IS NOT NULL AND `on` <= DATE_SUB(CURDATE(), INTERVAL 30 DAY)",
      )
    )[0][0].n,
  );
  check(overdue === overdueSql, `overdue shipped unchanged (got ${overdue}, expected ${overdueSql})`);

  if (failures.length) {
    console.log(`[invoice-exception-filter] ${failures.length} failure(s)`);
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    process.exitCode = 1;
  } else {
    console.log("[invoice-exception-filter] passed");
  }
  await sequelize.close();
})().catch((error) => {
  console.error("[invoice-exception-filter] crashed:", error.message);
  process.exit(1);
});
