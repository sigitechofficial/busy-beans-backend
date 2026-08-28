/**
 * Fetch one or more QBO Customer records from a partner (local partner) realm.
 * Read-only — does not modify QBO or the database.
 *
 * Run:
 *   node scripts/fetchPartnerQboCustomer.js
 *   node scripts/fetchPartnerQboCustomer.js --customer-id 229
 *   node scripts/fetchPartnerQboCustomer.js --customer-ids 229,231 --sales-rep-id 5
 *   node scripts/fetchPartnerQboCustomer.js --customer-id 229 --invoices-limit 20
 *   node scripts/fetchPartnerQboCustomer.js --customer-id 229 --user-id 384
 *
 * Env (optional):
 *   QBO_FETCH_PARTNER_REALM_ID
 *   QBO_FETCH_PARTNER_SALES_REP_ID
 *   QBO_FETCH_PARTNER_CUSTOMER_ID   default 229
 */

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const axios = require("axios");
const db = require("../models");
const { refreshAccessTokenIfNeeded } = require("../services/qboTokenService");
const { QBO, MINOR, headers } = require("../services/qboHelpers");

function parseArgs(argv) {
  const defaultId = process.env.QBO_FETCH_PARTNER_CUSTOMER_ID || "229";
  const args = {
    realmId:
      process.env.QBO_FETCH_PARTNER_REALM_ID || "9341454897011945",
    salesRepId: Number(
      process.env.QBO_FETCH_PARTNER_SALES_REP_ID || "5",
    ),
    customerIds: [String(defaultId).trim()],
    invoicesLimit: 15,
    userId: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--realm") args.realmId = String(argv[++i] || "").trim();
    else if (a === "--sales-rep-id")
      args.salesRepId = Number(argv[++i]);
    else if (a === "--customer-id") args.customerIds = [String(argv[++i]).trim()];
    else if (a === "--customer-ids") {
      args.customerIds = String(argv[++i] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === "--invoices-limit")
      args.invoicesLimit = Math.min(100, Math.max(1, Number(argv[++i]) || 15));
    else if (a === "--user-id") args.userId = Number(argv[++i]);
    else if (a === "--help" || a === "-h") args.help = true;
  }

  return args;
}

function printHelp() {
  console.log(`
Fetch QBO Customer(s) from a partner realm (read-only).

Options:
  --customer-id <id>       Single customer (default: 229)
  --customer-ids <a,b>     Multiple customers to compare (e.g. 229,231)
  --realm <id>             Partner realm (default: 9341454897011945)
  --sales-rep-id <n>       Token lookup (default: 5)
  --invoices-limit <n>     Recent invoices per customer (default: 15)
  --user-id <n>            Also print qboCustomerMaps row(s) for this userId
`);
}

async function fetchCustomerById(accessToken, realmId, customerId) {
  const safeId = String(customerId).trim();
  const url = `${QBO(realmId)}/customer/${encodeURIComponent(safeId)}?minorversion=${MINOR}`;
  const res = await axios.get(url, {
    headers: headers(accessToken),
    validateStatus: () => true,
  });

  if (res.status !== 200 || !res.data?.Customer) {
    return {
      ok: false,
      customerId: safeId,
      status: res.status,
      fault: res.data?.Fault || res.data,
    };
  }

  const c = res.data.Customer;
  return {
    ok: true,
    customerId: safeId,
    customer: {
      Id: c.Id,
      DisplayName: c.DisplayName,
      CompanyName: c.CompanyName,
      GivenName: c.GivenName,
      FamilyName: c.FamilyName,
      PrimaryEmailAddr: c.PrimaryEmailAddr?.Address,
      PrimaryPhone: c.PrimaryPhone?.FreeFormNumber,
      Active: c.Active,
      Balance: c.Balance,
      BalanceWithJobs: c.BalanceWithJobs,
      SyncToken: c.SyncToken,
      MetaData: c.MetaData,
    },
    raw: c,
  };
}

async function fetchRecentInvoicesForCustomer(
  accessToken,
  realmId,
  customerId,
  limit,
) {
  const safeId = String(customerId).replace(/'/g, "''");
  const q = `select Id, DocNumber, TxnDate, TotalAmt, Balance, CustomerRef from Invoice where CustomerRef = '${safeId}' orderby TxnDate desc maxresults ${limit}`;
  const url = `${QBO(realmId)}/query?query=${encodeURIComponent(q)}&minorversion=${MINOR}`;
  const res = await axios.get(url, {
    headers: headers(accessToken),
    validateStatus: () => true,
  });

  if (res.status !== 200) {
    return {
      ok: false,
      fault: res.data?.Fault || res.data,
      invoices: [],
    };
  }

  const raw = res.data?.QueryResponse?.Invoice;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return {
    ok: true,
    invoices: list.map((inv) => ({
      Id: inv.Id,
      DocNumber: inv.DocNumber,
      TxnDate: inv.TxnDate,
      TotalAmt: inv.TotalAmt,
      Balance: inv.Balance,
      CustomerRef: inv.CustomerRef?.value,
    })),
  };
}

async function fetchLocalMaps({ realmId, salesRepId, userId, customerIds }) {
  const where = {
    realmId: String(realmId),
    salesRepId,
  };
  if (userId) where.userId = userId;

  const rows = await db.qboCustomerMap.findAll({
    where,
    order: [["id", "ASC"]],
  });

  console.log("\n--- Local qboCustomerMaps (partner realm) ---");
  if (!rows.length) {
    console.log("  (no rows)");
    return;
  }

  for (const row of rows) {
    const json = row.toJSON ? row.toJSON() : row;
    const match = customerIds.includes(String(json.qboCustomerId));
    console.log(
      `  id=${json.id} userId=${json.userId} qboCustomerId=${json.qboCustomerId}${match ? "  <-- matches fetched id" : ""}`,
    );
  }
}

function printCustomerSummary(result) {
  if (!result.ok) {
    console.log(`\n❌ Customer ${result.customerId}: HTTP ${result.status}`);
    if (result.fault) console.log(JSON.stringify(result.fault, null, 2));
    return;
  }

  console.log(`\n✅ Customer ${result.customerId}`);
  console.log(JSON.stringify(result.customer, null, 2));
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

  console.log("Fetch partner QBO customer(s)");
  console.log({
    realmId: args.realmId,
    salesRepId: args.salesRepId,
    customerIds: args.customerIds,
    invoicesLimit: args.invoicesLimit,
    userId: args.userId,
  });

  const condition = {
    realmId: args.realmId,
    salesRepId: args.salesRepId,
  };

  const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
    condition,
  });

  if (!accessToken || !realmId) {
    console.error("Partner QBO token missing. Reconnect partner QuickBooks.");
    process.exit(1);
  }

  console.log(`\nConnected to partner realm: ${realmId}`);

  let anyFailed = false;

  for (const customerId of args.customerIds) {
    const result = await fetchCustomerById(accessToken, realmId, customerId);
    printCustomerSummary(result);

    if (!result.ok) {
      anyFailed = true;
      continue;
    }

    const inv = await fetchRecentInvoicesForCustomer(
      accessToken,
      realmId,
      customerId,
      args.invoicesLimit,
    );

    console.log(`\n  Recent invoices (customer ${customerId}, limit ${args.invoicesLimit}):`);
    if (!inv.ok) {
      console.log("  Query failed:", JSON.stringify(inv.fault, null, 2));
      anyFailed = true;
    } else if (!inv.invoices.length) {
      console.log("  (none)");
    } else {
      for (const row of inv.invoices) {
        console.log(
          `    Id=${row.Id} DocNumber=${row.DocNumber} TxnDate=${row.TxnDate} Total=${row.TotalAmt} Balance=${row.Balance}`,
        );
      }
    }
  }

  if (args.userId || args.customerIds.length) {
    try {
      await fetchLocalMaps({
        realmId: args.realmId,
        salesRepId: args.salesRepId,
        userId: args.userId,
        customerIds: args.customerIds,
      });
    } catch (dbErr) {
      console.warn("\nCould not load qboCustomerMaps:", dbErr.message);
    }
  }

  console.log("\nDone (read-only).");
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  if (err?.response?.data) {
    console.error(JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
