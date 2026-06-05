/**
 * Sparse-update a partner QBO customer with fixed name fields (no QBO source customer).
 *
 * Default target: 229 (Loews Lakewood GSCC — keeps existing invoices).
 * Applies static portal name fields for Lakewood/GSCC.
 *
 * Run:
 *   node scripts/updatePartnerQboCustomerFromSource.js --dry-run
 *   node scripts/updatePartnerQboCustomerFromSource.js --target-id 229 --confirm
 *   node scripts/updatePartnerQboCustomerFromSource.js --target-id 229 --confirm --update-db-map --from-map-customer-id 231
 *
 * Env:
 *   QBO_UPDATE_PARTNER_REALM_ID
 *   QBO_UPDATE_PARTNER_SALES_REP_ID
 *   QBO_UPDATE_TARGET_CUSTOMER_ID   default 229
 */

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const axios = require("axios");
const db = require("../models");
const { refreshAccessTokenIfNeeded } = require("../services/qboTokenService");
const { QBO, MINOR, headers } = require("../services/qboHelpers");

/** Static fields applied to the target QBO customer (not read from customer 231). */
const STATIC_CUSTOMER_FIELDS = {
  DisplayName: "Lakewood- GSCC",
  CompanyName: "Lakewood- GSCC",
  GivenName: "Brian  Kagan",
};

function parseArgs(argv) {
  const args = {
    dryRun: false,
    confirm: false,
    updateDbMap: false,
    fromMapCustomerId: null,
    realmId:
      process.env.QBO_UPDATE_PARTNER_REALM_ID || "9341454897011945",
    salesRepId: Number(
      process.env.QBO_UPDATE_PARTNER_SALES_REP_ID || "5",
    ),
    targetId: String(
      process.env.QBO_UPDATE_TARGET_CUSTOMER_ID || "229",
    ).trim(),
    fields: { ...STATIC_CUSTOMER_FIELDS },
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--confirm") args.confirm = true;
    else if (a === "--update-db-map") args.updateDbMap = true;
    else if (a === "--from-map-customer-id")
      args.fromMapCustomerId = String(argv[++i] || "").trim();
    else if (a === "--realm") args.realmId = String(argv[++i] || "").trim();
    else if (a === "--sales-rep-id")
      args.salesRepId = Number(argv[++i]);
    else if (a === "--target-id") args.targetId = String(argv[++i] || "").trim();
    else if (a === "--display-name")
      args.fields.DisplayName = String(argv[++i] || "");
    else if (a === "--company-name")
      args.fields.CompanyName = String(argv[++i] || "");
    else if (a === "--given-name")
      args.fields.GivenName = String(argv[++i] || "");
    else if (a === "--help" || a === "-h") args.help = true;
  }

  return args;
}

function printHelp() {
  console.log(`
Update partner QBO customer with static name fields (no source customer in QBO).

Default fields:
  DisplayName: "${STATIC_CUSTOMER_FIELDS.DisplayName}"
  CompanyName: "${STATIC_CUSTOMER_FIELDS.CompanyName}"
  GivenName:   "${STATIC_CUSTOMER_FIELDS.GivenName}"

Options:
  --target-id <id>              Customer to update (default: 229)
  --realm / --sales-rep-id
  --dry-run / --confirm
  --display-name / --company-name / --given-name   Override static values
  --update-db-map               Repoint qboCustomerMaps to target id
  --from-map-customer-id <id>   With --update-db-map: only rows with this qboCustomerId (e.g. 231)

Example:
  node scripts/updatePartnerQboCustomerFromSource.js --target-id 229 --confirm
  node scripts/updatePartnerQboCustomerFromSource.js --target-id 229 --confirm --update-db-map --from-map-customer-id 231
`);
}

async function getCustomer(accessToken, realmId, customerId) {
  const url = `${QBO(realmId)}/customer/${encodeURIComponent(customerId)}?minorversion=${MINOR}`;
  const res = await axios.get(url, {
    headers: headers(accessToken),
    validateStatus: () => true,
  });
  if (res.status !== 200 || !res.data?.Customer) {
    return { ok: false, status: res.status, fault: res.data?.Fault || res.data };
  }
  return { ok: true, customer: res.data.Customer };
}

function summarizeCustomer(c) {
  return {
    Id: c.Id,
    DisplayName: c.DisplayName,
    CompanyName: c.CompanyName,
    GivenName: c.GivenName,
    FamilyName: c.FamilyName,
    Active: c.Active,
  };
}

function buildSparsePayload(target, fields) {
  return {
    Id: String(target.Id),
    SyncToken: String(target.SyncToken),
    sparse: true,
    DisplayName: fields.DisplayName,
    CompanyName: fields.CompanyName,
    GivenName: fields.GivenName,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log("Partner QBO — update customer (static fields)");
  console.log({
    targetId: args.targetId,
    realmId: args.realmId,
    salesRepId: args.salesRepId,
    fields: args.fields,
    dryRun: args.dryRun,
    updateDbMap: args.updateDbMap,
    fromMapCustomerId: args.fromMapCustomerId,
  });

  const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
    condition: { realmId: args.realmId, salesRepId: args.salesRepId },
  });
  if (!accessToken || !realmId) {
    console.error("Partner QBO token missing. Reconnect partner QuickBooks.");
    process.exit(1);
  }

  const targetGot = await getCustomer(accessToken, realmId, args.targetId);
  if (!targetGot.ok) {
    console.error("Target GET failed:", targetGot.fault || targetGot.status);
    process.exit(1);
  }

  console.log("\nBEFORE target", args.targetId);
  console.log(summarizeCustomer(targetGot.customer));

  const payload = buildSparsePayload(targetGot.customer, args.fields);
  console.log("\nPlanned sparse payload:");
  console.log(JSON.stringify(payload, null, 2));

  if (args.dryRun) {
    console.log("\n[DRY RUN] No POST. Add --confirm to apply.");
    process.exit(0);
  }

  if (!args.confirm) {
    console.error("\nRefusing without --confirm");
    process.exit(1);
  }

  if (args.updateDbMap && !args.fromMapCustomerId) {
    console.error(
      "--update-db-map requires --from-map-customer-id (e.g. 231) so only those map rows are repointed.",
    );
    process.exit(1);
  }

  const postUrl = `${QBO(realmId)}/customer?minorversion=${MINOR}`;
  const res = await axios.post(postUrl, payload, {
    headers: {
      ...headers(accessToken),
      "Content-Type": "application/json",
    },
    validateStatus: () => true,
  });

  if (res.status < 200 || res.status >= 300 || !res.data?.Customer) {
    console.error(
      "Update failed:",
      JSON.stringify(res.data?.Fault || res.data, null, 2),
    );
    process.exit(1);
  }

  console.log("\n✅ AFTER target", args.targetId);
  console.log(summarizeCustomer(res.data.Customer));

  if (args.updateDbMap) {
    const where = {
      realmId: String(args.realmId),
      salesRepId: args.salesRepId,
      qboCustomerId: String(args.fromMapCustomerId),
    };
    const [n] = await db.qboCustomerMap.update(
      { qboCustomerId: String(args.targetId) },
      { where },
    );
    console.log(
      `\nDB: ${n} qboCustomerMaps row(s): qboCustomerId ${args.fromMapCustomerId} -> ${args.targetId}`,
    );
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
