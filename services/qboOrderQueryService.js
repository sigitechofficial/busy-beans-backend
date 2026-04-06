const { Op } = require("sequelize");
const { order, partnerOrder } = require("../models");

/** Orders with an admin QuickBooks invoice (non-empty id). */
function whereAdminQboInvoiceSynced() {
  return {
    quickBooksInvoiceId: {
      [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }],
    },
  };
}

/**
 * Parse cutoff: `DD-MM-YYYY` (e.g. 01-03-2026 = 1 March 2026 UTC start of day)
 * or any string `Date` understands (ISO 8601).
 * `createdAt` must be strictly **before** this instant.
 */
function parseCutoffInput(input) {
  if (input == null || input === "") {
    return new Date("2026-03-01T00:00:00.000Z");
  }

  const trimmed = String(input).trim();
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error("Invalid cutoffDate");
    }
    const d = new Date(Date.UTC(year, month - 1, day));
    if (
      d.getUTCFullYear() !== year ||
      d.getUTCMonth() !== month - 1 ||
      d.getUTCDate() !== day
    ) {
      throw new Error("Invalid cutoffDate");
    }
    return d;
  }

  const iso = new Date(trimmed);
  if (Number.isNaN(iso.getTime())) {
    throw new Error("Invalid cutoffDate");
  }
  return iso;
}

/**
 * Lists customer and partner orders that have an admin QBO invoice synced
 * and were created before the cutoff (default: start of March 2026 UTC).
 *
 * @param {string|Date} [cutoffInput] — `DD-MM-YYYY` or ISO string; exclusive upper bound for `createdAt`
 */
async function listAdminQboSyncedOrdersBeforeCutoff(cutoffInput) {
  const cutoff = parseCutoffInput(cutoffInput);

  const baseWhere = {
    ...whereAdminQboInvoiceSynced(),
    createdAt: { [Op.lt]: cutoff },
    deleted: false,
  };

  const attributes = [
    "id",
    "quickBooksInvoiceId",
    "quickBooksPaymentId",
    "adminRealmId",
    "createdAt",
    "invoiceNumber",
  ];

  const [customerRows, partnerRows] = await Promise.all([
    order.findAll({
      where: baseWhere,
      attributes,
      order: [["createdAt", "ASC"]],
    }),
    partnerOrder.findAll({
      where: baseWhere,
      attributes,
      order: [["createdAt", "ASC"]],
    }),
  ]);

  const mapRow = (row, orderType) => {
    const plain = row.get({ plain: true });
    return {
      orderType,
      id: plain.id,
      quickBooksInvoiceId: plain.quickBooksInvoiceId,
      quickBooksPaymentId: plain.quickBooksPaymentId ?? null,
      adminRealmId: plain.adminRealmId ?? null,
      createdAt: plain.createdAt,
      invoiceNumber: plain.invoiceNumber ?? null,
    };
  };

  return {
    cutoff: cutoff.toISOString(),
    customerOrders: customerRows.map((r) => mapRow(r, "customer")),
    partnerOrders: partnerRows.map((r) => mapRow(r, "local-partner")),
    customerOrdersIdsOnly: customerRows.map((r) => r.id),
    partnerOrdersIdsOnly: partnerRows.map((r) => r.id),
    counts: {
      customer: customerRows.length,
      partner: partnerRows.length,
      total: customerRows.length + partnerRows.length,
    },
  };
}

module.exports = {
  listAdminQboSyncedOrdersBeforeCutoff,
  whereAdminQboInvoiceSynced,
  parseCutoffInput,
};
