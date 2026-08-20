/**
 * Lambda / cron job: find paid customer orders that need QBO invoice and/or
 * payment sync, then for each order:
 *   - with salesRepId  → partner invoice (if missing) then partner payment
 *   - without salesRep → admin invoice (if missing) then admin payment
 *
 * Reuses syncInvoiceOnQuikBooks + syncPaymentToQuickBooks.
 */

const { Op } = require("sequelize");
const { order } = require("../models");
const { syncInvoiceOnQuikBooks } = require("./syncInvoiceOnQBO");
const { syncPaymentToQuickBooks } = require("./paymentSyncService");

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 10;
const ORDER_PAUSE_MS = 300;

const VALID_SYNC_SIDES = new Set(["admin", "partner", "both"]);

const CANDIDATE_ATTRIBUTES = [
  "id",
  "salesRepId",
  "quickBooksInvoiceId",
  "quickBooksPaymentId",
  "quickBooksInvoiceIdPartner",
  "quickBooksPaymentIdPartner",
  "paymentStatus",
];

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function invoicePresent(field) {
  return {
    [field]: {
      [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }],
    },
  };
}

function invoiceMissing(field) {
  return {
    [field]: { [Op.or]: [null, ""] },
  };
}

function paymentMissing(field) {
  return {
    [field]: { [Op.or]: [null, ""] },
  };
}

/**
 * Paid customer orders needing invoice and/or payment sync on the
 * appropriate side (admin if no salesRep, partner if salesRep present).
 *
 * @param {'admin'|'partner'|'both'} [syncSide='both']
 */
function buildUnsyncedPaidWhere(syncSide = "both") {
  const side = normalizeSyncSide(syncSide);

  const adminPath = {
    salesRepId: null,
    [Op.or]: [
      invoiceMissing("quickBooksInvoiceId"),
      {
        ...invoicePresent("quickBooksInvoiceId"),
        ...paymentMissing("quickBooksPaymentId"),
      },
    ],
  };

  const partnerPath = {
    salesRepId: { [Op.ne]: null },
    [Op.or]: [
      invoiceMissing("quickBooksInvoiceIdPartner"),
      {
        ...invoicePresent("quickBooksInvoiceIdPartner"),
        ...paymentMissing("quickBooksPaymentIdPartner"),
      },
    ],
  };

  const pathFilter =
    side === "admin"
      ? adminPath
      : side === "partner"
        ? partnerPath
        : { [Op.or]: [adminPath, partnerPath] };

  return {
    deleted: false,
    statusId: { [Op.ne]: 6 },
    paymentStatus: "done",
    ...pathFilter,
  };
}

function normalizeLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function normalizeSyncSide(syncSide) {
  const side = String(syncSide || "both").toLowerCase();
  if (!VALID_SYNC_SIDES.has(side)) {
    throw new Error(
      `Invalid syncSide "${syncSide}". Expected admin, partner, or both.`,
    );
  }
  return side;
}

function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  if (typeof value === "boolean") return value;
  return String(value) !== "false" && value !== false && String(value) !== "0";
}

function resolvePath(row) {
  return row?.salesRepId ? "partner" : "admin";
}

function plannedActionsForOrder(row) {
  const path = resolvePath(row);
  const actions = [];

  if (path === "partner") {
    if (isBlank(row.quickBooksInvoiceIdPartner)) {
      actions.push("sync_invoice");
    }
    // Payment may still be needed after invoice sync (or already have invoice)
    if (
      isBlank(row.quickBooksPaymentIdPartner) &&
      (!isBlank(row.quickBooksInvoiceIdPartner) ||
        actions.includes("sync_invoice"))
    ) {
      actions.push("sync_payment");
    }
  } else {
    if (isBlank(row.quickBooksInvoiceId)) {
      actions.push("sync_invoice");
    }
    if (
      isBlank(row.quickBooksPaymentId) &&
      (!isBlank(row.quickBooksInvoiceId) || actions.includes("sync_invoice"))
    ) {
      actions.push("sync_payment");
    }
  }

  return { path, actions };
}

/**
 * @param {{ limit?: number, syncSide?: string }} [opts]
 * @returns {Promise<object[]>}
 */
async function findUnsyncedPaidCustomerOrders({
  limit,
  syncSide = "both",
} = {}) {
  const capped = normalizeLimit(limit);
  const side = normalizeSyncSide(syncSide);

  return order.findAll({
    attributes: CANDIDATE_ATTRIBUTES,
    where: buildUnsyncedPaidWhere(side),
    order: [["id", "ASC"]],
    limit: capped,
    raw: true,
  });
}

async function findUnsyncedPaidCustomerOrderIds(opts = {}) {
  const rows = await findUnsyncedPaidCustomerOrders(opts);
  return rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process one paid order: invoice (if missing) then payment (if still needed).
 */
async function processOneOrder(row) {
  const orderId = Number(row.id);
  const path = resolvePath(row);
  const result = {
    orderId,
    path,
    status: "success",
    message: "",
    invoice: null,
    payment: null,
  };

  const needsInvoice =
    path === "partner"
      ? isBlank(row.quickBooksInvoiceIdPartner)
      : isBlank(row.quickBooksInvoiceId);

  if (needsInvoice) {
    try {
      const invoiceResult = await syncInvoiceOnQuikBooks({
        orderId,
        orderType: "customer",
      });
      result.invoice = {
        status: "success",
        message: invoiceResult?.message || "Invoice synced",
      };
    } catch (err) {
      result.invoice = {
        status: "failed",
        message: err.message || "Invoice sync failed",
      };
      result.status = "failed";
      result.message = `Invoice sync failed: ${err.message}`;
      return result;
    }
  } else {
    result.invoice = {
      status: "skipped",
      message: "Invoice already present",
    };
  }

  // Payment sync reloads the order, so a newly created invoice id is visible.
  const paymentSyncSide = path; // "admin" | "partner"
  try {
    const paymentResult = await syncPaymentToQuickBooks({
      orderId,
      orderType: "customer",
      syncSide: paymentSyncSide,
    });
    result.payment = {
      status: paymentResult?.status || "success",
      message: paymentResult?.message || "Payment synced",
      paymentId: paymentResult?.paymentId,
    };

    if (paymentResult?.status === "failed") {
      result.status = result.invoice?.status === "success" ? "partial" : "failed";
      result.message = paymentResult.message || "Payment sync failed";
    } else if (paymentResult?.status === "partial") {
      result.status = "partial";
      result.message = paymentResult.message || "Partial payment sync";
    } else if (result.invoice?.status === "success") {
      result.message = "Invoice and payment processed";
    } else {
      result.message = paymentResult?.message || "Payment processed";
    }
  } catch (err) {
    result.payment = {
      status: "failed",
      message: err.message || "Payment sync failed",
    };
    result.status =
      result.invoice?.status === "success" ? "partial" : "failed";
    result.message = `Payment sync failed: ${err.message}`;
  }

  return result;
}

/**
 * Find candidates and sync missing invoices then payments (or dry-run).
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.dryRun=false]
 * @param {number} [opts.limit=10]
 * @param {'admin'|'partner'|'both'} [opts.syncSide='both']
 */
async function syncUnsyncedPaidCustomerOrderPayments({
  dryRun = false,
  limit = DEFAULT_LIMIT,
  syncSide = "both",
} = {}) {
  const cappedLimit = normalizeLimit(limit);
  const side = normalizeSyncSide(syncSide);
  const rows = await findUnsyncedPaidCustomerOrders({
    limit: cappedLimit,
    syncSide: side,
  });
  const orderIds = rows.map((r) => Number(r.id));

  const base = {
    dryRun: !!dryRun,
    limit: cappedLimit,
    syncSide: side,
    candidateCount: orderIds.length,
    orderIds,
  };

  if (!rows.length) {
    return {
      ...base,
      skipped: true,
      message: "No paid customer orders needing invoice or payment sync",
      total: 0,
      successCount: 0,
      partialCount: 0,
      failureCount: 0,
      skippedCount: 0,
      results: [],
    };
  }

  if (dryRun) {
    const results = rows.map((row) => {
      const planned = plannedActionsForOrder(row);
      return {
        orderId: Number(row.id),
        path: planned.path,
        actions: planned.actions,
        salesRepId: row.salesRepId || null,
      };
    });

    return {
      ...base,
      skipped: true,
      message: `Dry run: ${rows.length} candidate order(s) would be processed`,
      total: rows.length,
      successCount: 0,
      partialCount: 0,
      failureCount: 0,
      skippedCount: 0,
      results,
    };
  }

  console.log(
    `[QBO][UnsyncedPaidJob] Processing ${rows.length} paid order(s), syncSide=${side}`,
  );

  const results = [];
  let successCount = 0;
  let partialCount = 0;
  let failureCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    console.log(
      `🔄 [QBO][UnsyncedPaidJob] Order ${row.id} path=${resolvePath(row)}`,
    );

    const outcome = await processOneOrder(row);
    results.push(outcome);

    if (outcome.status === "success") successCount++;
    else if (outcome.status === "partial") partialCount++;
    else if (outcome.status === "failed") failureCount++;

    if (i < rows.length - 1) {
      await sleep(ORDER_PAUSE_MS);
    }
  }

  const message = `Processed ${rows.length} order(s): ${successCount} success, ${partialCount} partial, ${failureCount} failed`;

  console.log(`[QBO][UnsyncedPaidJob] ${message}`);

  return {
    ...base,
    skipped: false,
    total: rows.length,
    successCount,
    partialCount,
    failureCount,
    skippedCount: 0,
    results,
    message,
  };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  buildUnsyncedPaidWhere,
  findUnsyncedPaidCustomerOrders,
  findUnsyncedPaidCustomerOrderIds,
  syncUnsyncedPaidCustomerOrderPayments,
  parseBool,
  normalizeLimit,
  normalizeSyncSide,
  plannedActionsForOrder,
};
