/**
 * Read-only audit: for every order in the local DB that points to an admin
 * QBO invoice, ask QBO whether more than one Payment is linked to that
 * invoice. Prints a table of the duplicates so you can decide which Payment
 * rows to void / delete on QBO before applying the code fix.
 *
 * The script does NOT modify any DB row, never POSTs to QBO, never deletes
 * anything. Pure inspection.
 *
 * Run:
 *   node scripts/auditQboDuplicatePayments.js
 *   node scripts/auditQboDuplicatePayments.js --limit 100
 *   node scripts/auditQboDuplicatePayments.js --order-type local-partner
 *   node scripts/auditQboDuplicatePayments.js --include-all  (also show singles)
 *
 * Env overrides:
 *   QBO_AUDIT_DEFAULT_LIMIT  default 500
 *   QBO_AUDIT_PAGE_SIZE      default 50 (concurrency batch size for QBO queries)
 *
 * Output sections:
 *   1. SUMMARY:  scanned vs duplicates vs missing-payment vs errors
 *   2. DUPLICATES: orders whose QBO invoice has >= 2 linked Payments
 *   3. (optional) MISSING-PAYMENT: invoices closed without any linked Payment
 *      (the "zombie" rows the current recovery logic targets)
 */

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const axios = require("axios");
const db = require("../models");
const {
  refreshAccessTokenIfNeeded,
} = require("../services/qboTokenService");

const BASE =
  (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const QBO = (realmId) => `${BASE}/v3/company/${realmId}`;
const MINOR = 70;

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/json",
  "Content-Type": "application/json",
});

function parseArgs(argv) {
  const args = { limit: null, orderType: "customer", includeAll: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--limit") args.limit = parseInt(argv[++i], 10);
    else if (a === "--order-type") args.orderType = argv[++i];
    else if (a === "--include-all") args.includeAll = true;
  }
  return args;
}

async function fetchOrdersWithQboInvoice({ orderType, limit }) {
  const MODEL =
    orderType === "local-partner" ? db.partnerOrder : db.order;
  const orders = await MODEL.findAll({
    where: {
      quickBooksInvoiceId: { [db.Sequelize.Op.ne]: null },
    },
    attributes: [
      "id",
      "invoiceNumber",
      "totalBill",
      "paymentStatus",
      "paymentMethod",
      "quickBooksInvoiceId",
      "quickBooksPaymentId",
      "adminRealmId",
      "pulloutIntentId",
      "paymentIntentId",
    ],
    order: [["id", "DESC"]],
    limit: limit && limit > 0 ? limit : undefined,
    raw: true,
  });
  return orders;
}

/**
 * Targeted QBO query: find every Payment whose LinkedTxn[].TxnId equals our
 * invoice id and TxnType is "Invoice".
 */
async function findLinkedPayments({ accessToken, realmId, invoiceId }) {
  const safeId = String(invoiceId).replace(/'/g, "''");
  const query = `select Id, TotalAmt, TxnDate, PaymentRefNum, LinkedTxn from Payment where Any(LinkedTxn.TxnId) = '${safeId}' and Any(LinkedTxn.TxnType) = 'Invoice'`;
  const url = `${QBO(realmId)}/query?minorversion=${MINOR}&query=${encodeURIComponent(query)}`;
  const res = await axios.get(url, {
    headers: headers(accessToken),
    validateStatus: () => true,
  });
  if (res.status !== 200) {
    return {
      ok: false,
      error: `HTTP ${res.status} - ${
        res.data?.Fault?.Error?.[0]?.Message ||
        res.data?.Fault?.Error?.[0]?.Detail ||
        JSON.stringify(res.data)
      }`,
      payments: [],
    };
  }
  const list = res.data?.QueryResponse?.Payment;
  const payments = Array.isArray(list) ? list : list ? [list] : [];
  // Filter to only payments that ACTUALLY link this invoice (QBO's Any()
  // semantics are robust but belt-and-suspenders is cheap).
  const filtered = payments.filter((p) => {
    const txns = Array.isArray(p.LinkedTxn) ? p.LinkedTxn : [p.LinkedTxn];
    return txns.some(
      (lt) =>
        String(lt?.TxnId) === String(invoiceId) &&
        String(lt?.TxnType) === "Invoice",
    );
  });
  return { ok: true, payments: filtered };
}

async function fetchInvoiceMeta({ accessToken, realmId, invoiceId }) {
  const url = `${QBO(realmId)}/invoice/${encodeURIComponent(invoiceId)}?minorversion=${MINOR}`;
  const res = await axios.get(url, {
    headers: headers(accessToken),
    validateStatus: () => true,
  });
  if (res.status !== 200) {
    return {
      ok: false,
      error: `HTTP ${res.status} - ${
        res.data?.Fault?.Error?.[0]?.Message ||
        res.data?.Fault?.Error?.[0]?.Detail ||
        JSON.stringify(res.data)
      }`,
    };
  }
  const inv = res.data?.Invoice;
  return {
    ok: true,
    TotalAmt: inv?.TotalAmt ?? null,
    Balance: inv?.Balance ?? null,
    DocNumber: inv?.DocNumber ?? null,
    Status: inv?.EmailStatus ?? null,
  };
}

function summarize(payments) {
  if (!payments.length) return { count: 0, total: 0, ids: "" };
  const total = payments.reduce(
    (s, p) => s + Number(p.TotalAmt || 0),
    0,
  );
  return {
    count: payments.length,
    total,
    ids: payments.map((p) => p.Id).join(", "),
  };
}

async function processOrder({ accessToken, realmId, row }) {
  if (!row.quickBooksInvoiceId) {
    return { row, status: "no_qbo_invoice" };
  }
  const realmForRow = realmId; // admin realm only — this script audits admin QBO.

  const invoiceId = String(row.quickBooksInvoiceId).trim();
  const [paymentsRes, invMeta] = await Promise.all([
    findLinkedPayments({ accessToken, realmId: realmForRow, invoiceId }),
    fetchInvoiceMeta({ accessToken, realmId: realmForRow, invoiceId }),
  ]);

  if (!paymentsRes.ok) {
    return {
      row,
      status: "error",
      error: `payments query: ${paymentsRes.error}`,
    };
  }
  if (!invMeta.ok) {
    return {
      row,
      status: "error",
      error: `invoice fetch: ${invMeta.error}`,
    };
  }

  const summary = summarize(paymentsRes.payments);
  const balance = Number(invMeta.Balance ?? 0);
  const totalAmt = Number(invMeta.TotalAmt ?? 0);

  let status;
  if (summary.count >= 2) status = "duplicate_payments";
  else if (summary.count === 1) status = "single_payment";
  else if (balance <= 0 && totalAmt > 0) status = "closed_no_payment";
  else status = "open_no_payment";

  return {
    row,
    status,
    invoice: invMeta,
    payments: paymentsRes.payments,
    summary,
  };
}

async function runBatched(items, limit, fn) {
  const results = [];
  let i = 0;
  while (i < items.length) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
    i += limit;
    process.stdout.write(
      `  scanned ${Math.min(i, items.length)} / ${items.length}\r`,
    );
  }
  process.stdout.write("\n");
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  const defaultLimit = Math.max(
    1,
    parseInt(process.env.QBO_AUDIT_DEFAULT_LIMIT || "500", 10),
  );
  const pageSize = Math.max(
    1,
    Math.min(100, parseInt(process.env.QBO_AUDIT_PAGE_SIZE || "50", 10)),
  );
  const limit = args.limit && args.limit > 0 ? args.limit : defaultLimit;

  console.log("[AUDIT] QBO duplicate-payment audit");
  console.log(
    `[AUDIT] config: orderType=${args.orderType}, limit=${limit}, concurrency=${pageSize}, includeAll=${args.includeAll}`,
  );

  const account = await db.account.findOne({});
  if (!account?.currentRealmId) {
    throw new Error("No admin account / currentRealmId found in DB.");
  }
  const realmId = account.currentRealmId;
  console.log(`[AUDIT] admin realmId: ${realmId}`);

  const { accessToken } = await refreshAccessTokenIfNeeded({
    condition: { realmId, accountId: account.id },
  });
  if (!accessToken) throw new Error("Could not get QBO access token.");

  const rows = await fetchOrdersWithQboInvoice({
    orderType: args.orderType,
    limit,
  });
  console.log(
    `[AUDIT] candidates: ${rows.length} rows with quickBooksInvoiceId`,
  );

  if (rows.length === 0) {
    console.log("[AUDIT] nothing to audit.");
    return;
  }

  const results = await runBatched(rows, pageSize, (row) =>
    processOrder({ accessToken, realmId, row }).catch((err) => ({
      row,
      status: "error",
      error: err?.message || String(err),
    })),
  );

  const buckets = {
    duplicate_payments: [],
    closed_no_payment: [],
    single_payment: [],
    open_no_payment: [],
    no_qbo_invoice: [],
    error: [],
  };
  for (const r of results) {
    (buckets[r.status] || (buckets[r.status] = [])).push(r);
  }

  console.log("\n=========================================================");
  console.log("[AUDIT] SUMMARY");
  console.log("=========================================================");
  console.table([
    {
      scanned: results.length,
      duplicate_payments: buckets.duplicate_payments.length,
      closed_no_payment: buckets.closed_no_payment.length,
      single_payment: buckets.single_payment.length,
      open_no_payment: buckets.open_no_payment.length,
      errors: buckets.error.length,
    },
  ]);

  if (buckets.duplicate_payments.length) {
    console.log("\n=========================================================");
    console.log(
      `[AUDIT] DUPLICATE PAYMENTS (${buckets.duplicate_payments.length})`,
    );
    console.log(
      "  -> these invoices on QBO carry 2+ Payment rows; balance may be NEGATIVE.",
    );
    console.log("=========================================================");
    console.table(
      buckets.duplicate_payments.map((r) => ({
        orderId: r.row.id,
        invoiceNumber: r.row.invoiceNumber,
        qboInvoiceId: r.row.quickBooksInvoiceId,
        docNumber: r.invoice.DocNumber,
        totalAmt: r.invoice.TotalAmt,
        balance: r.invoice.Balance,
        paymentCount: r.summary.count,
        paymentsTotal: r.summary.total,
        paymentIds: r.summary.ids,
        dbQboPaymentId: r.row.quickBooksPaymentId || "(missing)",
        paymentMethod: r.row.paymentMethod,
      })),
    );

    // Also emit a raw JSON dump so the team can pipe into a file for cleanup.
    console.log("\n[AUDIT] DUPLICATE PAYMENTS (raw JSON):");
    console.log(
      JSON.stringify(
        buckets.duplicate_payments.map((r) => ({
          orderId: r.row.id,
          qboInvoiceId: r.row.quickBooksInvoiceId,
          invoice: r.invoice,
          payments: r.payments.map((p) => ({
            Id: p.Id,
            TotalAmt: p.TotalAmt,
            TxnDate: p.TxnDate,
            PaymentRefNum: p.PaymentRefNum,
          })),
        })),
        null,
        2,
      ),
    );
  }

  if (buckets.closed_no_payment.length) {
    console.log("\n=========================================================");
    console.log(
      `[AUDIT] CLOSED WITHOUT LINKED PAYMENT (${buckets.closed_no_payment.length})`,
    );
    console.log(
      "  -> QBO invoice Balance is 0 but no Payment row references it.",
    );
    console.log(
      "  -> after the code fix, these will return skipped/paid_no_linked_payment unless allowRecovery is passed.",
    );
    console.log("=========================================================");
    console.table(
      buckets.closed_no_payment.map((r) => ({
        orderId: r.row.id,
        invoiceNumber: r.row.invoiceNumber,
        qboInvoiceId: r.row.quickBooksInvoiceId,
        totalAmt: r.invoice.TotalAmt,
        balance: r.invoice.Balance,
        dbQboPaymentId: r.row.quickBooksPaymentId || "(missing)",
        paymentMethod: r.row.paymentMethod,
      })),
    );
  }

  if (buckets.error.length) {
    console.log("\n=========================================================");
    console.log(`[AUDIT] ERRORS (${buckets.error.length})`);
    console.log("=========================================================");
    console.table(
      buckets.error.slice(0, 25).map((r) => ({
        orderId: r.row.id,
        qboInvoiceId: r.row.quickBooksInvoiceId,
        error: String(r.error).slice(0, 160),
      })),
    );
    if (buckets.error.length > 25) {
      console.log(`  (${buckets.error.length - 25} more errors not shown)`);
    }
  }

  if (args.includeAll && buckets.single_payment.length) {
    console.log("\n=========================================================");
    console.log(
      `[AUDIT] SINGLE PAYMENT (healthy) (${buckets.single_payment.length})`,
    );
    console.log("=========================================================");
    console.table(
      buckets.single_payment.slice(0, 50).map((r) => ({
        orderId: r.row.id,
        invoiceNumber: r.row.invoiceNumber,
        qboInvoiceId: r.row.quickBooksInvoiceId,
        balance: r.invoice.Balance,
        paymentId: r.summary.ids,
        paymentTotal: r.summary.total,
      })),
    );
    if (buckets.single_payment.length > 50) {
      console.log(
        `  (${buckets.single_payment.length - 50} more rows not shown — pass --include-all to see; truncating display here)`,
      );
    }
  }

  console.log("\n[AUDIT] done. No files modified.");
}

main()
  .catch((err) => {
    console.error("\n[AUDIT][ERROR]", err?.message || err);
    if (err?.response?.data) {
      console.error("   QBO response:", JSON.stringify(err.response.data));
    }
    process.exit(1);
  })
  .finally(async () => {
    try {
      await db.sequelize?.close?.();
    } catch (e) {
      // ignore close errors
    }
  });
