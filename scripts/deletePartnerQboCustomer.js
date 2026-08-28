/**
 * Delete or deactivate a QBO Customer in a partner (local partner) realm.
 * Default: customer 231.
 *
 * QBO may refuse hard-delete when the customer has invoices/payments — use
 * --deactivate-only or remove invoices first (see deletePartnerQboInvoices.js).
 *
 * Run:
 *   node scripts/deletePartnerQboCustomer.js --dry-run
 *   node scripts/deletePartnerQboCustomer.js --customer-id 231 --confirm
 *   node scripts/deletePartnerQboCustomer.js --customer-id 231 --deactivate-only --confirm
 *   node scripts/deletePartnerQboCustomer.js --customer-id 231 --confirm --update-db-map --reassign-map-to 229
 *
 * Env:
 *   QBO_DELETE_PARTNER_REALM_ID
 *   QBO_DELETE_PARTNER_SALES_REP_ID
 *   QBO_DELETE_PARTNER_CUSTOMER_ID   default 231
 */

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const axios = require("axios");
const db = require("../models");
const { refreshAccessTokenIfNeeded } = require("../services/qboTokenService");
const { QBO, MINOR, headers } = require("../services/qboHelpers");

function parseArgs(argv) {
  const args = {
    dryRun: false,
    confirm: false,
    deactivateOnly: false,
    updateDbMap: false,
    reassignMapTo: null,
    realmId: process.env.QBO_DELETE_PARTNER_REALM_ID || "9341454897011945",
    salesRepId: Number(process.env.QBO_DELETE_PARTNER_SALES_REP_ID || "5"),
    customerId: String(
      process.env.QBO_DELETE_PARTNER_CUSTOMER_ID || "231",
    ).trim(),
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--confirm") args.confirm = true;
    else if (a === "--deactivate-only") args.deactivateOnly = true;
    else if (a === "--update-db-map") args.updateDbMap = true;
    else if (a === "--reassign-map-to")
      args.reassignMapTo = String(argv[++i] || "").trim();
    else if (a === "--realm") args.realmId = String(argv[++i] || "").trim();
    else if (a === "--sales-rep-id") args.salesRepId = Number(argv[++i]);
    else if (a === "--customer-id")
      args.customerId = String(argv[++i] || "").trim();
    else if (a === "--help" || a === "-h") args.help = true;
  }

  return args;
}

function printHelp() {
  console.log(`
Delete or deactivate a partner QBO customer (admin QBO is never touched).

Options:
  --customer-id <id>       Customer to remove (default: 231)
  --realm <id>             Partner realm (default: 9341454897011945)
  --sales-rep-id <n>       Token lookup (default: 5)
  --dry-run                GET customer + invoice count only
  --confirm                Required to change QBO or DB
  --deactivate-only        Set Active=false if hard delete fails
  --update-db-map          Update qboCustomerMaps after success
  --reassign-map-to <id>   With --update-db-map, set qboCustomerId (e.g. 229)

Examples:
  node scripts/deletePartnerQboCustomer.js --customer-id 231 --dry-run
  node scripts/deletePartnerQboCustomer.js --customer-id 231 --confirm --update-db-map --reassign-map-to 229
`);
}

async function getCustomer(accessToken, realmId, customerId) {
  const url = `${QBO(realmId)}/customer/${encodeURIComponent(customerId)}?minorversion=${MINOR}`;
  const res = await axios.get(url, {
    headers: headers(accessToken),
    validateStatus: () => true,
  });
  if (res.status !== 200 || !res.data?.Customer) {
    return {
      ok: false,
      status: res.status,
      fault: res.data?.Fault || res.data,
    };
  }
  return { ok: true, customer: res.data.Customer };
}

async function countInvoices(accessToken, realmId, customerId) {
  const safeId = String(customerId).replace(/'/g, "''");
  const q = `select count(*) from Invoice where CustomerRef = '${safeId}'`;
  const url = `${QBO(realmId)}/query?query=${encodeURIComponent(q)}&minorversion=${MINOR}`;
  const res = await axios.get(url, {
    headers: headers(accessToken),
    validateStatus: () => true,
  });
  return Number(res.data?.QueryResponse?.totalCount || 0);
}

async function deleteCustomerInQbo(accessToken, realmId, customer) {
  const deleteUrl = `${QBO(realmId)}/customer?operation=delete&minorversion=${MINOR}`;
  await axios.post(
    deleteUrl,
    { Id: String(customer.Id), SyncToken: String(customer.SyncToken) },
    {
      headers: {
        ...headers(accessToken),
        "Content-Type": "application/json",
      },
    },
  );
}

async function deactivateCustomerInQbo(accessToken, realmId, customer) {
  const postUrl = `${QBO(realmId)}/customer?minorversion=${MINOR}`;
  const res = await axios.post(
    postUrl,
    {
      Id: String(customer.Id),
      SyncToken: String(customer.SyncToken),
      sparse: true,
      Active: false,
    },
    {
      headers: {
        ...headers(accessToken),
        "Content-Type": "application/json",
      },
    },
  );
  return res.data?.Customer;
}

async function reassignLocalMaps({
  realmId,
  salesRepId,
  fromCustomerId,
  toCustomerId,
}) {
  const where = {
    realmId: String(realmId),
    salesRepId,
    qboCustomerId: String(fromCustomerId),
  };
  const [n] = await db.qboCustomerMap.update(
    { qboCustomerId: String(toCustomerId) },
    { where },
  );
  console.log(
    `  qboCustomerMaps: ${n} row(s) ${fromCustomerId} -> ${toCustomerId}`,
  );
  return n;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.realmId) {
    console.error("Missing --realm");
    process.exit(1);
  }
  if (!args.salesRepId || Number.isNaN(args.salesRepId)) {
    console.error("Invalid --sales-rep-id");
    process.exit(1);
  }

  console.log("Partner QBO — delete/deactivate customer");
  console.log({
    customerId: args.customerId,
    realmId: args.realmId,
    salesRepId: args.salesRepId,
    dryRun: args.dryRun,
    deactivateOnly: args.deactivateOnly,
    updateDbMap: args.updateDbMap,
    reassignMapTo: args.reassignMapTo,
  });

  const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
    condition: { realmId: args.realmId, salesRepId: args.salesRepId },
  });
  if (!accessToken || !realmId) {
    console.error("Partner QBO token missing. Reconnect partner QuickBooks.");
    process.exit(1);
  }

  const got = await getCustomer(accessToken, realmId, args.customerId);
  if (!got.ok) {
    console.error("Customer GET failed:", got.fault || got.status);
    process.exit(1);
  }

  const c = got.customer;
  const invoiceCount = await countInvoices(
    accessToken,
    realmId,
    args.customerId,
  );

  console.log("\nCustomer in QBO:");
  console.log({
    Id: c.Id,
    DisplayName: c.DisplayName,
    CompanyName: c.CompanyName,
    GivenName: c.GivenName,
    Active: c.Active,
    Balance: c.Balance,
    linkedInvoiceCount: invoiceCount,
  });

  if (invoiceCount > 0) {
    console.warn(
      `\n⚠️ ${invoiceCount} invoice(s) still reference this customer. Hard delete may fail.`,
    );
    console.warn(
      "   Delete invoices first (deletePartnerQboInvoices.js) or use --deactivate-only.",
    );
  }

  if (args.dryRun) {
    console.log("\n[DRY RUN] No changes. Add --confirm to execute.");
    process.exit(0);
  }

  if (!args.confirm) {
    console.error("\nRefusing without --confirm");
    process.exit(1);
  }

  if (args.updateDbMap && !args.reassignMapTo) {
    console.error("--update-db-map requires --reassign-map-to <id>");
    process.exit(1);
  }

  try {
    if (args.deactivateOnly) {
      const updated = await deactivateCustomerInQbo(accessToken, realmId, c);
      console.log("\n✅ Deactivated (Active=false):", updated?.DisplayName);
    } else {
      await deleteCustomerInQbo(accessToken, realmId, c);
      console.log("\n✅ Deleted customer from QBO:", args.customerId);
    }
  } catch (err) {
    const msg = err?.response?.data?.Fault?.Error?.[0]?.Message || err?.message;
    console.error("\n❌ QBO failed:", msg);
    console.error("Retry with: --deactivate-only --confirm");
    process.exit(1);
  }

  if (args.updateDbMap && args.reassignMapTo) {
    await reassignLocalMaps({
      realmId: args.realmId,
      salesRepId: args.salesRepId,
      fromCustomerId: args.customerId,
      toCustomerId: args.reassignMapTo,
    });
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  if (err?.response?.data) {
    console.error(JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
