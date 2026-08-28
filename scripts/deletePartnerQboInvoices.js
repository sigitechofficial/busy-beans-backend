/**
 * Delete specific partner-realm QBO invoices and clear partner invoice/payment
 * fields on local orders that reference them.
 *
 * Use when partner invoices were linked under the wrong QBO customer (e.g. after
 * re-importing the customer map). Admin QBO is never touched.
 *
 * Run (dry-run first):
 *   node scripts/deletePartnerQboInvoices.js --dry-run
 *   node scripts/deletePartnerQboInvoices.js --invoices 2175,2288 --sales-rep-id 5 --realm 9341454897011945
 *
 * Env defaults (optional):
 *   QBO_DELETE_PARTNER_REALM_ID
 *   QBO_DELETE_PARTNER_SALES_REP_ID
 *   QBO_DELETE_PARTNER_INVOICE_IDS   comma-separated
 */

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const axios = require("axios");
const { Op } = require("sequelize");
const db = require("../models");
const { refreshAccessTokenIfNeeded } = require("../services/qboTokenService");
const { deleteInvoiceInRealm } = require("../services/qboDeleteInvoice");
const { QBO, MINOR, headers } = require("../services/qboHelpers");

function parseArgs(argv) {
  const args = {
    dryRun: false,
    skipDb: false,
    realmId:
      process.env.QBO_DELETE_PARTNER_REALM_ID || "9341454897011945",
    salesRepId: Number(
      process.env.QBO_DELETE_PARTNER_SALES_REP_ID || "5",
    ),
    invoiceIds: (process.env.QBO_DELETE_PARTNER_INVOICE_IDS || "2175,2288")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--skip-db") args.skipDb = true;
    else if (a === "--realm") args.realmId = String(argv[++i] || "").trim();
    else if (a === "--sales-rep-id")
      args.salesRepId = Number(argv[++i]);
    else if (a === "--invoices") {
      args.invoiceIds = String(argv[++i] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === "--help" || a === "-h") {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Delete partner QBO invoices and clear order partner invoice fields.

Options:
  --dry-run              Inspect only (GET invoice + list DB orders)
  --skip-db              Delete in QBO but do not update orders table
  --realm <id>           Partner QBO company id (default: env or 9341454897011945)
  --sales-rep-id <n>     Local partner salesRepId for token (default: 5)
  --invoices <a,b,c>     Comma-separated QBO invoice ids (default: 2175,2288)

Examples:
  node scripts/deletePartnerQboInvoices.js --dry-run
  node scripts/deletePartnerQboInvoices.js --invoices 2175,2288 --sales-rep-id 5
`);
}

async function fetchInvoiceSummary(accessToken, realmId, invoiceId) {
  const safeId = String(invoiceId).trim();
  const getUrl = `${QBO(realmId)}/invoice/${encodeURIComponent(safeId)}?minorversion=${MINOR}`;
  const getRes = await axios.get(getUrl, {
    headers: headers(accessToken),
    validateStatus: () => true,
  });

  if (getRes.status !== 200 || !getRes.data?.Invoice) {
    return {
      ok: false,
      invoiceId: safeId,
      status: getRes.status,
      fault: getRes.data?.Fault || getRes.data,
    };
  }

  const inv = getRes.data.Invoice;
  const safeInv = safeId.replace(/'/g, "''");
  const payQ = `select Id, TotalAmt from Payment where Any(LinkedTxn.TxnId) = '${safeInv}' and Any(LinkedTxn.TxnType) = 'Invoice'`;
  const payUrl = `${QBO(realmId)}/query?query=${encodeURIComponent(payQ)}&minorversion=${MINOR}`;
  const payRes = await axios.get(payUrl, {
    headers: headers(accessToken),
    validateStatus: () => true,
  });

  let linkedPayments = [];
  if (payRes.status === 200) {
    const raw = payRes.data?.QueryResponse?.Payment;
    linkedPayments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  }

  return {
    ok: true,
    invoiceId: safeId,
    docNumber: inv.DocNumber,
    customerId: inv.CustomerRef?.value,
    balance: inv.Balance,
    totalAmt: inv.TotalAmt,
    syncToken: inv.SyncToken,
    linkedPaymentIds: linkedPayments.map((p) => p.Id),
  };
}

async function findOrdersForPartnerInvoices(realmId, invoiceIds) {
  return db.order.findAll({
    where: {
      partnerRealmId: String(realmId),
      quickBooksInvoiceIdPartner: { [Op.in]: invoiceIds.map(String) },
    },
    attributes: [
      "id",
      "invoiceNumber",
      "userId",
      "salesRepId",
      "quickBooksInvoiceIdPartner",
      "quickBooksPaymentIdPartner",
      "partnerRealmId",
    ],
    order: [["id", "ASC"]],
  });
}

async function clearPartnerInvoiceFieldsOnOrders(orderIds) {
  if (!orderIds.length) return 0;
  const [count] = await db.order.update(
    {
      quickBooksInvoiceIdPartner: null,
      quickBooksPaymentIdPartner: null,
      paymentSyncedToQBO: false,
    },
    { where: { id: { [Op.in]: orderIds } } },
  );
  return count;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.realmId) {
    console.error("Missing --realm or QBO_DELETE_PARTNER_REALM_ID");
    process.exit(1);
  }
  if (!args.salesRepId || Number.isNaN(args.salesRepId)) {
    console.error("Invalid --sales-rep-id");
    process.exit(1);
  }
  if (!args.invoiceIds.length) {
    console.error("No invoice ids. Use --invoices or QBO_DELETE_PARTNER_INVOICE_IDS");
    process.exit(1);
  }

  console.log("Partner QBO invoice delete script");
  console.log({
    dryRun: args.dryRun,
    skipDb: args.skipDb,
    realmId: args.realmId,
    salesRepId: args.salesRepId,
    invoiceIds: args.invoiceIds,
  });

  const condition = {
    realmId: args.realmId,
    salesRepId: args.salesRepId,
  };

  const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
    condition,
  });

  if (!accessToken || !realmId) {
    console.error("Partner QBO token missing or disconnected for:", condition);
    process.exit(1);
  }

  const orders = await findOrdersForPartnerInvoices(args.realmId, args.invoiceIds);
  console.log(
    `\nDB orders referencing these partner invoices: ${orders.length}`,
  );
  for (const o of orders) {
    console.log(
      `  order#${o.id} inv=${o.invoiceNumber} partnerInvoice=${o.quickBooksInvoiceIdPartner} partnerPayment=${o.quickBooksPaymentIdPartner || "NULL"}`,
    );
  }

  const inspection = [];
  for (const invoiceId of args.invoiceIds) {
    const summary = await fetchInvoiceSummary(accessToken, realmId, invoiceId);
    inspection.push(summary);
    if (!summary.ok) {
      console.warn(`\n⚠️ Invoice ${invoiceId}: GET failed`, summary.fault || summary.status);
    } else {
      console.log(`\nInvoice ${invoiceId}:`);
      console.log({
        docNumber: summary.docNumber,
        customerId: summary.customerId,
        balance: summary.balance,
        totalAmt: summary.totalAmt,
        linkedPayments: summary.linkedPaymentIds,
      });
      if (summary.linkedPaymentIds.length > 0) {
        console.warn(
          "  ⚠️ Linked payment(s) exist — QBO delete may fail until payments are removed in QBO.",
        );
      }
    }
  }

  if (args.dryRun) {
    console.log("\n[DRY RUN] No deletes performed. Re-run without --dry-run to execute.");
    process.exit(0);
  }

  const deleted = [];
  const failed = [];

  for (const invoiceId of args.invoiceIds) {
    try {
      await deleteInvoiceInRealm(accessToken, realmId, invoiceId);
      console.log(`\n✅ Deleted partner QBO invoice ${invoiceId}`);
      deleted.push(invoiceId);
    } catch (err) {
      const msg =
        err?.response?.data?.Fault?.Error?.[0]?.Message ||
        err?.message ||
        "Unknown error";
      console.error(`\n❌ Failed to delete invoice ${invoiceId}:`, msg);
      failed.push({ invoiceId, message: msg });
    }
  }

  let ordersUpdated = 0;
  if (!args.skipDb && deleted.length > 0) {
    const orderIdsToClear = orders
      .filter((o) => deleted.includes(String(o.quickBooksInvoiceIdPartner)))
      .map((o) => o.id);
    ordersUpdated = await clearPartnerInvoiceFieldsOnOrders(orderIdsToClear);
    console.log(
      `\nDB: cleared partner invoice/payment fields on ${ordersUpdated} order row(s).`,
    );
  } else if (args.skipDb) {
    console.log("\nDB: skipped (--skip-db).");
  }

  console.log("\nSummary:", {
    deleted,
    failed,
    ordersUpdated,
  });

  if (failed.length) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  if (err?.response?.data) {
    console.error(JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
