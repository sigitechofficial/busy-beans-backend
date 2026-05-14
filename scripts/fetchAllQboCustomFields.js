/**
 * Read-only script: List ALL QBO custom fields available on the admin's
 * connected company. Combines two sources:
 *   1. GraphQL `appFoundationsCustomFieldDefinitions` (definitions catalog)
 *   2. REST invoice scan (recent invoices with `include=enhancedAllCustomFields`)
 *      to surface every DefinitionId actually present on invoices - useful when
 *      GraphQL is empty (scopes / plan) but invoices still carry custom fields.
 *
 * Does NOT modify .env or any DB row. Pure inspection script.
 *
 * Run: node scripts/fetchAllQboCustomFields.js
 *   or: npm run qbo:list-custom-fields
 *
 * Optional env overrides:
 *   QBO_LIST_CF_INVOICE_LIMIT  (default 50)  Max invoices to scan
 *   QBO_LIST_CF_PAGE_SIZE      (default 25)  Page size for invoice queries
 */
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const axios = require("axios");

const db = require("../models");
const { refreshAccessTokenIfNeeded } = require("../services/qboTokenService");

const BASE =
  (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const QBO = (realmId) => `${BASE}/v3/company/${realmId}`;
const MINOR = 70;
const MINOR_WITH_CUSTOM_FIELDS = 75;
const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/json",
  "Content-Type": "application/json",
});

const INVOICE_LIMIT = Math.max(
  1,
  parseInt(process.env.QBO_LIST_CF_INVOICE_LIMIT || "50", 10),
);
const PAGE_SIZE = Math.max(
  1,
  Math.min(100, parseInt(process.env.QBO_LIST_CF_PAGE_SIZE || "25", 10)),
);

const GRAPHQL_CUSTOM_FIELDS_QUERY = `
  query {
    appFoundationsCustomFieldDefinitions {
      id
      name
      type
      legacyIdV2
    }
  }
`;

async function fetchGraphQLCustomFieldDefinitions(accessToken) {
  const graphqlUrl = "https://qb.api.intuit.com/graphql";
  const response = await axios.post(
    graphqlUrl,
    { query: GRAPHQL_CUSTOM_FIELDS_QUERY },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    },
  );
  const errors = response?.data?.errors;
  const list = response?.data?.data?.appFoundationsCustomFieldDefinitions;
  return {
    list: Array.isArray(list) ? list : [],
    errors,
    fullBody: response?.data,
  };
}

function logGraphQLDefinitionsResult({ list, errors, fullBody }) {
  if (errors?.length) {
    console.log("\n[WARN] GraphQL errors (custom field definitions):");
    console.log(JSON.stringify(errors, null, 2));
  }
  if (!list.length) {
    console.log(
      "\n[INFO] GraphQL appFoundationsCustomFieldDefinitions: (empty or unavailable - check scopes / company)",
    );
    if (fullBody && !fullBody.data) {
      console.log(
        "   Full GraphQL response:",
        JSON.stringify(fullBody, null, 2),
      );
    }
    return;
  }
  console.log(
    "\n[INFO] ALL QuickBooks custom field definitions (GraphQL) - legacyIdV2 matches Invoice CustomField.DefinitionId:",
  );
  console.table(
    list.map((f) => ({
      name: f.name ?? "",
      legacyIdV2:
        f.legacyIdV2 != null && f.legacyIdV2 !== ""
          ? String(f.legacyIdV2)
          : "",
      type: f.type ?? "",
      id: f.id ?? "",
    })),
  );
  console.log("\n[INFO] GraphQL definitions (raw JSON):");
  console.log(JSON.stringify(list, null, 2));
}

function normalizeInvoiceCustomFields(invoice) {
  const raw = invoice?.CustomField ?? invoice?.CustomFields;
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function formatInvoiceCustomFieldValue(f) {
  if (f.StringValue != null && String(f.StringValue).trim() !== "")
    return String(f.StringValue);
  if (f.BooleanValue !== undefined && f.BooleanValue !== null)
    return String(f.BooleanValue);
  return "(empty)";
}

async function listInvoiceIds(accessToken, realmId, totalLimit, pageSize) {
  const ids = [];
  let startPosition = 1;
  while (ids.length < totalLimit) {
    const remaining = totalLimit - ids.length;
    const take = Math.min(pageSize, remaining);
    const query = `SELECT Id FROM Invoice ORDER BY MetaData.LastUpdatedTime DESC STARTPOSITION ${startPosition} MAXRESULTS ${take}`;
    const url = `${QBO(realmId)}/query?minorversion=${MINOR}&query=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: headers(accessToken) });
    const batch = res.data?.QueryResponse?.Invoice || [];
    if (!batch.length) break;
    for (const inv of batch) {
      if (inv?.Id) ids.push(String(inv.Id));
    }
    if (batch.length < take) break;
    startPosition += batch.length;
  }
  return ids;
}

async function fetchInvoiceWithCustomFields(accessToken, realmId, invoiceId) {
  let url = `${QBO(realmId)}/invoice/${invoiceId}?minorversion=${MINOR_WITH_CUSTOM_FIELDS}&include=enhancedAllCustomFields`;
  try {
    const res = await axios.get(url, { headers: headers(accessToken) });
    return { invoice: res.data?.Invoice, usedInclude: true };
  } catch (e) {
    if (e.response?.status === 400) {
      url = `${QBO(realmId)}/invoice/${invoiceId}?minorversion=${MINOR_WITH_CUSTOM_FIELDS}`;
      const res = await axios.get(url, { headers: headers(accessToken) });
      return { invoice: res.data?.Invoice, usedInclude: false };
    }
    throw e;
  }
}

/**
 * Scans recent invoices and aggregates every CustomField by DefinitionId.
 * For each definition we keep: Name, Type, sample value, sample invoice id,
 * and counts of invoices that carried it.
 */
async function aggregateInvoiceCustomFields(accessToken, realmId) {
  const ids = await listInvoiceIds(
    accessToken,
    realmId,
    INVOICE_LIMIT,
    PAGE_SIZE,
  );
  console.log(
    `\n[INFO] Scanning ${ids.length} recent invoices for CustomField entries (limit=${INVOICE_LIMIT}, page=${PAGE_SIZE})...`,
  );

  const byDefId = new Map();
  let scanned = 0;
  let withInclude = 0;
  let withoutInclude = 0;
  let withAnyCustomField = 0;
  const errors = [];

  for (const invoiceId of ids) {
    try {
      const { invoice, usedInclude } = await fetchInvoiceWithCustomFields(
        accessToken,
        realmId,
        invoiceId,
      );
      scanned += 1;
      if (usedInclude) withInclude += 1;
      else withoutInclude += 1;

      const fields = normalizeInvoiceCustomFields(invoice);
      if (fields.length) withAnyCustomField += 1;

      for (const f of fields) {
        const defId = String(f.DefinitionId ?? f.Id ?? "").trim();
        if (!defId) continue;
        const existing = byDefId.get(defId);
        const value = formatInvoiceCustomFieldValue(f);
        if (!existing) {
          byDefId.set(defId, {
            DefinitionId: defId,
            Name: f.Name ?? f.name ?? "",
            Type: f.Type ?? f.type ?? "",
            sampleValue: value,
            sampleInvoiceId: invoiceId,
            invoicesSeen: 1,
            invoicesWithValue: value !== "(empty)" ? 1 : 0,
          });
        } else {
          existing.invoicesSeen += 1;
          if (value !== "(empty)") {
            existing.invoicesWithValue += 1;
            if (
              existing.sampleValue === "(empty)" ||
              !existing.sampleValue
            ) {
              existing.sampleValue = value;
              existing.sampleInvoiceId = invoiceId;
            }
          }
          if (!existing.Name && (f.Name || f.name))
            existing.Name = f.Name ?? f.name;
          if (!existing.Type && (f.Type || f.type))
            existing.Type = f.Type ?? f.type;
        }
      }
    } catch (e) {
      errors.push({ invoiceId, message: e.message });
    }
  }

  return {
    ids,
    scanned,
    withInclude,
    withoutInclude,
    withAnyCustomField,
    byDefId,
    errors,
  };
}

function logAggregatedInvoiceCustomFields(agg) {
  console.log(
    `\n[INFO] Invoice scan summary: scanned=${agg.scanned}, include=${agg.withInclude}, fallback=${agg.withoutInclude}, withCustomFields=${agg.withAnyCustomField}, errors=${agg.errors.length}`,
  );
  if (agg.errors.length) {
    console.log("   First few errors:");
    console.table(agg.errors.slice(0, 5));
  }

  const rows = Array.from(agg.byDefId.values()).sort((a, b) =>
    String(a.DefinitionId).localeCompare(String(b.DefinitionId)),
  );

  if (!rows.length) {
    console.log(
      "\n[INFO] No CustomField entries observed on scanned invoices. Try increasing QBO_LIST_CF_INVOICE_LIMIT.",
    );
    return;
  }

  console.log(
    "\n[INFO] ALL CustomField DefinitionIds observed on admin QBO invoices (deduplicated):",
  );
  console.table(rows);
  console.log("\n[INFO] Aggregated invoice CustomField (raw JSON):");
  console.log(JSON.stringify(rows, null, 2));
}

function logCombinedView(graphqlList, agg) {
  const byDefId = agg.byDefId;
  const graphqlByLegacy = new Map();
  for (const def of graphqlList) {
    const lid =
      def.legacyIdV2 != null && def.legacyIdV2 !== ""
        ? String(def.legacyIdV2).trim()
        : "";
    if (lid) graphqlByLegacy.set(lid, def);
  }

  const allIds = new Set([
    ...Array.from(byDefId.keys()),
    ...Array.from(graphqlByLegacy.keys()),
  ]);

  if (!allIds.size) {
    console.log(
      "\n[INFO] Combined view: no definitions or invoice CustomFields available.",
    );
    return;
  }

  const rows = Array.from(allIds)
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map((defId) => {
      const inv = byDefId.get(defId);
      const def = graphqlByLegacy.get(defId);
      return {
        DefinitionId: defId,
        Name: def?.name || inv?.Name || "",
        Type: def?.type || inv?.Type || "",
        graphqlId: def?.id || "",
        inGraphQL: def ? "yes" : "no",
        onInvoices: inv ? "yes" : "no",
        invoicesSeen: inv?.invoicesSeen ?? 0,
        invoicesWithValue: inv?.invoicesWithValue ?? 0,
        sampleValue: inv?.sampleValue ?? "(empty)",
        sampleInvoiceId: inv?.sampleInvoiceId ?? "",
      };
    });

  console.log(
    "\n[INFO] COMBINED view (GraphQL definitions union with invoice-observed CustomFields):",
  );
  console.table(rows);
}

async function main() {
  try {
    console.log(
      "[INFO] Listing ALL QBO custom fields available on admin's connected company...\n",
    );

    const account = await db.account.findOne({});
    if (!account || !account.currentRealmId) {
      throw new Error("No admin account or currentRealmId found.");
    }
    const realmId = account.currentRealmId;
    console.log(`[INFO] Admin realmId: ${realmId}`);

    const { accessToken } = await refreshAccessTokenIfNeeded({
      condition: { realmId },
    });
    if (!accessToken) throw new Error("Could not get QBO access token.");

    const gqlDefs = await fetchGraphQLCustomFieldDefinitions(accessToken);
    logGraphQLDefinitionsResult(gqlDefs);

    const agg = await aggregateInvoiceCustomFields(accessToken, realmId);
    logAggregatedInvoiceCustomFields(agg);

    logCombinedView(gqlDefs.list, agg);

    console.log("\n[OK] Done. No files were modified.");
  } catch (err) {
    console.error("\n[ERROR]", err.message);
    if (err.response?.data)
      console.error("   QBO response:", err.response.data);
    process.exit(1);
  } finally {
    await db.sequelize?.close?.();
  }
}

main();
