const { Op, literal } = require("sequelize");

function invoiceExceptionWhere(kind, tableAlias, extraWhere = {}) {
  const condition = { ...extraWhere };
  if (condition.deleted === undefined) condition.deleted = 0;

  const onCol = tableAlias ? `\`${tableAlias}\`.\`on\`` : "`on`";

  if (kind === "overdueShipped") {
    condition.statusId = { [Op.in]: [4, 5] };
    condition.paymentStatus = "pending";
    condition.invoiceDate = { [Op.ne]: null };
    const overdueLit = literal(
      `${onCol} <= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
    );
    condition[Op.and] = Array.isArray(condition[Op.and])
      ? [...condition[Op.and], overdueLit]
      : [overdueLit];
  } else if (kind === "shippedNotInvoiced") {
    condition.statusId = { [Op.in]: [4, 5] };
    condition.invoiceDate = { [Op.is]: null };
  }

  return condition;
}

function applyInvoiceException(req, condition, tableAlias) {
  const exception = req.query?.invoiceException;
  if (!exception) return;
  delete req.query.invoiceException;
  if (exception === "shippedNotInvoiced" && req.query?.invoiceDate) {
    delete req.query.invoiceDate;
  }

  Object.assign(condition, invoiceExceptionWhere(exception, tableAlias, condition));
}

module.exports = { applyInvoiceException, invoiceExceptionWhere };
