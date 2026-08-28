// services/qboPaymentService.js
// Fetches unapplied payments from a QuickBooks Online account.

const axios = require("axios");
const { Op } = require("sequelize");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { getActiveToken } = require("./qboTokenService");
const { QBO, MINOR, headers } = require("./qboHelpers");
const { handleQboError } = require("./qboErrorHandler");
const { account, order, partnerOrder } = require("../models");

const MAX_RESULTS = 1000;

/**
 * Get all unapplied payments from a QBO account.
 * Uses UnappliedAmt > 0 to identify payments that have not been fully applied to invoices.
 * Supports pagination (QBO returns max 1000 per request).
 *
 * @param {Object} [opts]
 * @param {Object} [opts.condition] - Optional condition to find the QBO token (e.g. { realmId, accountId } or { realmId, salesRepId }).
 *                                   If omitted, uses the single active token (getActiveToken).
 * @param {string} [opts.date] - Optional filter by transaction date (YYYY-MM-DD, e.g. "2026-02-17"). Only payments with TxnDate on this date are returned.
 * @returns {Promise<{ payments: Array<Object>, totalCount: number, ids: string[] }>} All unapplied payment objects and total count.
 */
async function getUnappliedPayments({ condition, date } = {}) {
  let accessToken;
  let realmId;

  if (condition) {
    const refreshed = await refreshAccessTokenIfNeeded({ condition });
    accessToken = refreshed.accessToken;
    realmId = refreshed.realmId;
  } else {
    const record = await getActiveToken();
    if (!record) throw new Error("No QuickBooks token record found.");
    const refreshed = await refreshAccessTokenIfNeeded({
      condition: { id: record.id },
    });
    accessToken = refreshed.accessToken;
    realmId = refreshed.realmId;
  }

  if (!accessToken || !realmId) {
    throw new Error("Missing QBO credentials (accessToken or realmId).");
  }

  const allPayments = [];
  let startPosition = 1;
  let hasMore = true;

  // QBO Query API does not support WHERE UnappliedAmt > 0 (UnappliedAmt is not a filterable field).
  // Fetch all payments with pagination, then filter in code for UnappliedAmt > 0.
  while (hasMore) {
    const query = `SELECT * FROM Payment STARTPOSITION ${startPosition} MAXRESULTS ${MAX_RESULTS}`;
    const url = `${QBO(realmId)}/query?minorversion=${MINOR}&query=${encodeURIComponent(query)}`;

    let res;
    try {
      res = await axios.get(url, { headers: headers(accessToken) });
    } catch (err) {
      handleQboError({
        err,
        context: "[QBO] Get unapplied payments query failed:",
      });
    }

    const queryResponse = res?.data?.QueryResponse;
    const payments = queryResponse?.Payment;

    if (payments) {
      const list = Array.isArray(payments) ? payments : [payments];
      allPayments.push(...list);
    }

    const returned = payments
      ? Array.isArray(payments)
        ? payments.length
        : 1
      : 0;
    hasMore = returned >= MAX_RESULTS;
    startPosition += MAX_RESULTS;
  }

  // Filter to only payments with unapplied amount > 0 (matches QBO "Unapplied" status in UI).
  // Fallback: if UnappliedAmt is not in the query response, treat as unapplied when no Line links to an Invoice.
  const unapplied = allPayments.filter((p) => {
    const amt = p.UnappliedAmt;
    if (amt != null && Number(amt) > 0) return true;
    const lines = p.Line;
    if (!lines || (Array.isArray(lines) && lines.length === 0)) return true;
    const linkedToInvoice = (Array.isArray(lines) ? lines : [lines]).some(
      (line) =>
        line.LinkedTxn &&
        (Array.isArray(line.LinkedTxn) ? line.LinkedTxn : [line.LinkedTxn]).some(
          (lt) => lt.TxnType === "Invoice"
        )
    );
    return !linkedToInvoice;
  });

  let payments = unapplied.map((p) => ({
    id: p.Id,
    paymentRefNum: p.PaymentRefNum ?? null,
    date: p.TxnDate ?? null,
    customerRef: p.CustomerRef
      ? {
          value: p.CustomerRef.value ?? null,
          name: p.CustomerRef.name ?? null,
        }
      : null,
  }));

  if (date) {
    const wantDate = String(date).trim().slice(0, 10);
    if (wantDate) {
      payments = payments.filter((p) => p.date && String(p.date).slice(0, 10) === wantDate);
    }
  }

  const ids = payments.map((p) => p.id);

  return {
    payments,
    totalCount: payments.length,
    ids,
  };
}

/**
 * Delete QBO payments by ID. Uses the same token/condition as getUnappliedPayments.
 * Fetches each payment to get SyncToken, then calls QBO delete.
 *
 * @param {Object} [opts]
 * @param {Object} [opts.condition] - Optional condition to find the QBO token (same as getUnappliedPayments).
 * @param {string[]} [opts.ids] - Array of QBO Payment Ids to delete.
 * @returns {Promise<{ deletedIds: string[], failedIds: string[], errors: Array<{ id: string, message: string }> }>}
 */
async function deletePaymentsByIds({ condition, ids } = {}) {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new Error("ids must be a non-empty array of payment IDs.");
  }

  let accessToken;
  let realmId;

  if (condition) {
    const refreshed = await refreshAccessTokenIfNeeded({ condition });
    accessToken = refreshed.accessToken;
    realmId = refreshed.realmId;
  } else {
    const record = await getActiveToken();
    if (!record) throw new Error("No QuickBooks token record found.");
    const refreshed = await refreshAccessTokenIfNeeded({
      condition: { id: record.id },
    });
    accessToken = refreshed.accessToken;
    realmId = refreshed.realmId;
  }

  if (!accessToken || !realmId) {
    throw new Error("Missing QBO credentials (accessToken or realmId).");
  }

  const deletedIds = [];
  const failedIds = [];
  const errors = [];

  for (const id of ids) {
    const safeId = String(id).trim();
    if (!safeId) continue;

    try {
      const getUrl = `${QBO(realmId)}/payment/${safeId}?minorversion=${MINOR}`;
      const getRes = await axios.get(getUrl, { headers: headers(accessToken) });
      const payment = getRes?.data?.Payment;
      const syncToken = payment?.SyncToken ?? "0";

      const deleteUrl = `${QBO(realmId)}/payment?operation=delete&minorversion=${MINOR}`;
      await axios.post(
        deleteUrl,
        { Id: safeId, SyncToken: syncToken },
        { headers: headers(accessToken) }
      );
      deletedIds.push(safeId);
    } catch (err) {
      failedIds.push(safeId);
      const message =
        err?.response?.data?.Fault?.Error?.[0]?.Message || err?.message || "Unknown error";
      errors.push({ id: safeId, message });
    }
  }

  return {
    deletedIds,
    failedIds,
    errors,
  };
}

/**
 * Delete payments in the **admin** QuickBooks company only (platform account).
 * Uses admin `currentRealmId` + `account` row for token lookup.
 *
 * @param {string[]} ids - QBO Payment Ids
 * @returns {Promise<{ deletedIds: string[], failedIds: string[], errors: Array<{ id: string, message: string }> }>}
 */
async function deleteAdminQboPaymentsByIds(ids) {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new Error("ids must be a non-empty array of payment IDs.");
  }

  const ADMIN = await account.findOne({});
  if (!ADMIN?.currentRealmId) {
    throw new Error("Admin QuickBooks is not connected (missing currentRealmId).");
  }

  const condition = {
    realmId: ADMIN.currentRealmId,
    accountId: ADMIN.id,
  };

  return deletePaymentsByIds({ condition, ids });
}

/**
 * For each order, delete its **admin** QBO payment (`quickBooksPaymentId`) and clear that field in DB.
 * Deduplicates by payment id so the same QBO payment is only deleted once.
 *
 * @param {Object} opts
 * @param {number[]} opts.orderIds
 * @param {'customer'|'local-partner'} [opts.orderType='customer'] — `order` vs `partnerOrder` model
 */
async function deleteAdminQboPaymentsForOrders({
  orderIds,
  orderType = "customer",
} = {}) {
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error("orderIds must be a non-empty array.");
  }

  const ADMIN = await account.findOne({});
  if (!ADMIN?.currentRealmId) {
    throw new Error("Admin QuickBooks is not connected (missing currentRealmId).");
  }

  const condition = {
    realmId: ADMIN.currentRealmId,
    accountId: ADMIN.id,
  };

  const MODEL = orderType === "local-partner" ? partnerOrder : order;
  const numericIds = [
    ...new Set(
      orderIds
        .map((id) => Number(id))
        .filter((n) => !Number.isNaN(n) && n > 0),
    ),
  ];
  if (numericIds.length === 0) {
    throw new Error("orderIds must contain valid numeric ids.");
  }

  const rows = await MODEL.findAll({
    where: { id: { [Op.in]: numericIds }, deleted: false },
    attributes: ["id", "quickBooksPaymentId"],
  });

  const foundIdSet = new Set(rows.map((r) => r.id));
  const ordersNotFound = numericIds.filter((id) => !foundIdSet.has(id));

  const paymentToOrderIds = new Map();
  const skippedNoAdminPayment = [];

  for (const row of rows) {
    const raw = row.quickBooksPaymentId;
    if (raw == null || String(raw).trim() === "") {
      skippedNoAdminPayment.push(row.id);
      continue;
    }
    const paymentId = String(raw).trim();
    if (!paymentToOrderIds.has(paymentId)) {
      paymentToOrderIds.set(paymentId, []);
    }
    paymentToOrderIds.get(paymentId).push(row.id);
  }

  const deletedPayments = [];
  const failedPayments = [];

  for (const [paymentId, affectedOrderIds] of paymentToOrderIds) {
    const batch = await deletePaymentsByIds({ condition, ids: [paymentId] });
    if (batch.deletedIds.includes(paymentId)) {
      await MODEL.update(
        {
          quickBooksPaymentId: null,
          paymentSyncedToQBO: false,
          qboLastSync: new Date(),
        },
        { where: { id: { [Op.in]: affectedOrderIds } } },
      );
      deletedPayments.push({ paymentId, orderIds: affectedOrderIds });
    } else {
      const errMsg =
        batch.errors.find((e) => e.id === paymentId)?.message ||
        "QuickBooks payment delete failed";
      failedPayments.push({
        paymentId,
        orderIds: affectedOrderIds,
        message: errMsg,
      });
    }
  }

  return {
    deletedPayments,
    failedPayments,
    skippedNoAdminPayment,
    ordersNotFound,
    orderType,
    summary: {
      paymentsDeleted: deletedPayments.length,
      paymentsFailed: failedPayments.length,
      ordersUpdated: deletedPayments.reduce(
        (n, d) => n + d.orderIds.length,
        0,
      ),
      skippedNoAdminPayment: skippedNoAdminPayment.length,
      ordersNotFound: ordersNotFound.length,
    },
  };
}

module.exports = {
  getUnappliedPayments,
  deletePaymentsByIds,
  deleteAdminQboPaymentsByIds,
  deleteAdminQboPaymentsForOrders,
};
