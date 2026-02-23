// services/qboPaymentService.js
// Fetches unapplied payments from a QuickBooks Online account.

const axios = require("axios");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { getActiveToken } = require("./qboTokenService");
const { QBO, MINOR, headers } = require("./qboHelpers");
const { handleQboError } = require("./qboErrorHandler");

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

module.exports = {
  getUnappliedPayments,
  deletePaymentsByIds,
};
