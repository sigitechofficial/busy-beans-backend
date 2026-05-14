/**
 * One-off script: Fetch any QBO invoice, extract the Sales Rep custom field
 * DefinitionId, and update .env with QBO_SALES_REP_CUSTOM_FIELD_ID.
 *
 * Logs: (1) all GraphQL custom field definitions, (2) invoice CustomField rows,
 * (3) merged table — every definition with value on this invoice or "(empty)".
 *
 * Run: node scripts/fetchQboSalesRepDefinitionIdAndUpdateEnv.js
 *   or: npm run qbo:sales-rep-id
 *
 * Optional: pick a specific QBO invoice id to inspect (overrides 175/DB/QBO discovery)
 *   - CLI:  node scripts/fetchQboSalesRepDefinitionIdAndUpdateEnv.js 31920
 *   - npm:  npm run qbo:sales-rep-id -- 31920
 *   - env:  QBO_INSPECT_INVOICE_ID=31920 npm run qbo:sales-rep-id
 */
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const { Op } = require("sequelize");
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
    console.log("\n⚠️ GraphQL errors (custom field definitions):");
    console.log(JSON.stringify(errors, null, 2));
  }
  if (!list.length) {
    console.log(
      "\n📊 GraphQL appFoundationsCustomFieldDefinitions: (empty or unavailable — check scopes / company)",
    );
    if (fullBody && !fullBody.data) {
      console.log("   Full GraphQL response:", JSON.stringify(fullBody, null, 2));
    }
    return;
  }
  console.log(
    "\n📊 ALL QuickBooks custom field definitions (GraphQL) — legacyIdV2 matches Invoice CustomField.DefinitionId:",
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
  console.log("\n📋 GraphQL definitions (raw JSON):");
  console.log(JSON.stringify(list, null, 2));
}

/** Invoice read: CustomField may be one object or an array. */
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

function logInvoiceCustomFieldsTable(invoice) {
  const rows = normalizeInvoiceCustomFields(invoice).map((f, index) => ({
    index,
    Name: f.Name ?? f.name ?? "",
    DefinitionId: f.DefinitionId != null ? String(f.DefinitionId) : "",
    Id: f.Id != null ? String(f.Id) : "",
    Type: f.Type ?? f.type ?? "",
    Value: formatInvoiceCustomFieldValue(f),
  }));
  console.log(
    "\n📊 Invoice CustomField rows returned on THIS invoice read (QBO may omit empty slots):",
  );
  if (rows.length === 0) {
    console.log("   (none)");
    return;
  }
  console.table(rows);
  console.log("\n📋 Invoice CustomField (raw JSON):");
  console.log(JSON.stringify(normalizeInvoiceCustomFields(invoice), null, 2));
}

/**
 * For every GraphQL definition, show value on this invoice or "(empty)".
 * Also lists invoice-only CustomFields not found in GraphQL list.
 */
function logMergedDefinitionsWithInvoiceValues(graphqlList, invoice) {
  const invFields = normalizeInvoiceCustomFields(invoice);
  const byDefId = new Map();
  for (const f of invFields) {
    const id = String(f.DefinitionId ?? f.Id ?? "").trim();
    if (id) byDefId.set(id, f);
  }

  if (graphqlList.length > 0) {
    const rows = graphqlList.map((def) => {
      const lid =
        def.legacyIdV2 != null && def.legacyIdV2 !== ""
          ? String(def.legacyIdV2).trim()
          : "";
      const inv = lid ? byDefId.get(lid) : undefined;
      const value = inv ? formatInvoiceCustomFieldValue(inv) : "(empty)";
      return {
        definitionName: def.name ?? "",
        graphqlType: def.type ?? "",
        legacyIdV2: lid,
        valueOnThisInvoice: value,
        onInvoicePayload: inv ? "yes" : "no",
      };
    });
    console.log(
      "\n📊 MERGED: every GraphQL definition × this invoice — '(empty)' = not present on invoice JSON (often unused slots):",
    );
    console.table(rows);
  } else {
    console.log(
      "\n📊 MERGED view skipped (no GraphQL definitions). Invoice-only rows are above.",
    );
  }

  const graphqlLegacyIds = new Set(
    graphqlList
      .map((d) =>
        d.legacyIdV2 != null && d.legacyIdV2 !== ""
          ? String(d.legacyIdV2).trim()
          : "",
      )
      .filter(Boolean),
  );
  const orphans = invFields.filter((f) => {
    const id = String(f.DefinitionId ?? f.Id ?? "").trim();
    if (!id) return true;
    return !graphqlLegacyIds.has(id);
  });
  if (orphans.length > 0) {
    console.log(
      "\n📋 Invoice CustomField entries NOT matched to any GraphQL legacyIdV2 (still on invoice):",
    );
    console.table(
      orphans.map((f) => ({
        Name: f.Name ?? "",
        DefinitionId: String(f.DefinitionId ?? f.Id ?? ""),
        Value: formatInvoiceCustomFieldValue(f),
      })),
    );
  }
}

function extractSalesRepDefinitionIdFromGraphQLList(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const salesRep = list.find(
    (f) =>
      f.name && /sales\s*rep|salesrep|local\s*partner/i.test(String(f.name)),
  );
  return salesRep?.legacyIdV2 ? String(salesRep.legacyIdV2) : null;
}

const PULLOUT_NAME_REGEX = /pullout[\s_]*intent[\s_]*id|pullout\s*intent|pulloutid|pullout/i;

function extractPulloutDefinitionId(invoice) {
  const customFields = normalizeInvoiceCustomFields(invoice);
  if (!customFields.length) return null;
  const pullout = customFields.find(
    (f) =>
      f.Name &&
      PULLOUT_NAME_REGEX.test(String(f.Name).replace(/_/g, " ")),
  );
  if (pullout && (pullout.DefinitionId != null || pullout.Id != null))
    return String(pullout.DefinitionId ?? pullout.Id);
  return null;
}

function extractPulloutDefinitionIdFromGraphQLList(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const pullout = list.find(
    (f) => f.name && PULLOUT_NAME_REGEX.test(String(f.name)),
  );
  return pullout?.legacyIdV2 ? String(pullout.legacyIdV2) : null;
}

async function getOneInvoiceIdFromDb() {
  const order = await db.order.findOne({
    where: { quickBooksInvoiceId: { [Op.ne]: null } },
    attributes: ["quickBooksInvoiceId", "adminRealmId"],
    raw: true,
  });
  return order
    ? { invoiceId: order.quickBooksInvoiceId, realmId: order.adminRealmId }
    : null;
}

async function getOneInvoiceIdFromQbo(accessToken, realmId) {
  const query = "SELECT Id FROM Invoice MAXRESULTS 1";
  const url = `${QBO(realmId)}/query?minorversion=${MINOR}&query=${encodeURIComponent(query)}`;
  const res = await axios.get(url, { headers: headers(accessToken) });
  const inv = res.data?.QueryResponse?.Invoice?.[0];
  return inv ? inv.Id : null;
}

async function listRecentInvoiceIdsFromQbo(accessToken, realmId, totalLimit, pageSize) {
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
    return res.data?.Invoice;
  } catch (e) {
    if (e.response?.status === 400) {
      url = `${QBO(realmId)}/invoice/${invoiceId}?minorversion=${MINOR_WITH_CUSTOM_FIELDS}`;
      const res = await axios.get(url, { headers: headers(accessToken) });
      return res.data?.Invoice;
    }
    throw e;
  }
}

/**
 * Scan recent invoices and return the first DefinitionId whose Name matches
 * the Pullout custom field. Useful when the chosen invoice doesn't carry it.
 */
async function findPulloutDefinitionIdByScanningInvoices(
  accessToken,
  realmId,
  limit,
  pageSize,
) {
  const ids = await listRecentInvoiceIdsFromQbo(accessToken, realmId, limit, pageSize);
  console.log(
    `\n🔎 Scanning ${ids.length} recent invoices to find Pullout custom field (limit=${limit}, page=${pageSize})...`,
  );
  for (const invoiceId of ids) {
    try {
      const invoice = await fetchInvoiceWithCustomFields(accessToken, realmId, invoiceId);
      const defId = extractPulloutDefinitionId(invoice);
      if (defId) {
        console.log(`✅ Found Pullout custom field on invoice ${invoiceId}: DefinitionId=${defId}`);
        return defId;
      }
    } catch (e) {
      // continue scanning
    }
  }
  return null;
}

function extractSalesRepDefinitionId(invoice) {
  const customFields = normalizeInvoiceCustomFields(invoice);
  if (!customFields.length) return null;
  // Prefer entry with Name "Sales Rep" or similar
  const salesRep = customFields.find(
    (f) =>
      f.Name &&
      /sales\s*rep|local\s*partner/i.test(String(f.Name).replace(/_/g, " ")),
  );
  if (salesRep && (salesRep.DefinitionId != null || salesRep.Id != null))
    return String(salesRep.DefinitionId ?? salesRep.Id);
  // Otherwise use first custom field (QBO often uses 1, 2, 3 for definition order)
  const first = customFields[0];
  if (first && (first.DefinitionId != null || first.Id != null))
    return String(first.DefinitionId ?? first.Id);
  return null;
}

function updateEnvFile(key, definitionId) {
  const envPath = path.resolve(__dirname, "../.env");
  let content = fs.readFileSync(envPath, "utf8");
  const newLine = `${key}=${definitionId}`;
  if (content.includes(key + "=")) {
    content = content.replace(new RegExp(`${key}=[^\r\n]*`, "g"), newLine);
  } else {
    content = content.trimEnd() + "\n" + newLine + "\n";
  }
  fs.writeFileSync(envPath, content, "utf8");
  console.log(`✅ Updated ${envPath}: ${newLine}`);
}

async function main() {
  try {
    console.log("🔍 Fetching QBO Sales Rep custom field DefinitionId...\n");

    const account = await db.account.findOne({});
    if (!account || !account.currentRealmId) {
      throw new Error("No admin account or currentRealmId found.");
    }
    const realmId = account.currentRealmId;
    const { accessToken } = await refreshAccessTokenIfNeeded({
      condition: { realmId },
    });
    if (!accessToken) throw new Error("Could not get QBO access token.");

    const gqlDefs = await fetchGraphQLCustomFieldDefinitions(accessToken);
    logGraphQLDefinitionsResult(gqlDefs);

    // Allow override via CLI arg or env (highest priority)
    const cliInvoiceId = (process.argv[2] || "").trim();
    const envInvoiceId = (process.env.QBO_INSPECT_INVOICE_ID || "").trim();
    const PREFERRED_INVOICE_ID = "175";
    const overrideInvoiceId = cliInvoiceId || envInvoiceId;

    const candidates = [];
    if (overrideInvoiceId) {
      candidates.push({
        id: overrideInvoiceId,
        label: cliInvoiceId
          ? `CLI arg (${overrideInvoiceId})`
          : `env QBO_INSPECT_INVOICE_ID (${overrideInvoiceId})`,
      });
    }
    candidates.push({
      id: PREFERRED_INVOICE_ID,
      label: `preferred (${PREFERRED_INVOICE_ID})`,
    });
    const fromDb = await getOneInvoiceIdFromDb();
    if (fromDb?.invoiceId)
      candidates.push({ id: String(fromDb.invoiceId), label: "DB" });
    try {
      const fromQbo = await getOneInvoiceIdFromQbo(accessToken, realmId);
      if (fromQbo) candidates.push({ id: String(fromQbo), label: "QBO query" });
    } catch (e) {
      // ignore — we'll error below if no candidate works
    }

    // Try each candidate with the enhancedAllCustomFields URL, fall back per-candidate
    let invoiceId = null;
    let invoice = null;
    for (const cand of candidates) {
      const id = cand.id;
      let getUrl = `${QBO(realmId)}/invoice/${id}?minorversion=${MINOR_WITH_CUSTOM_FIELDS}&include=enhancedAllCustomFields`;
      try {
        const res = await axios.get(getUrl, { headers: headers(accessToken) });
        invoice = res.data?.Invoice;
        if (invoice) {
          invoiceId = id;
          console.log(`📄 Using invoice ID ${id} from ${cand.label}`);
          break;
        }
      } catch (e) {
        const status = e.response?.status;
        if (status === 400) {
          // retry without include=enhancedAllCustomFields
          try {
            getUrl = `${QBO(realmId)}/invoice/${id}?minorversion=${MINOR_WITH_CUSTOM_FIELDS}`;
            const res = await axios.get(getUrl, { headers: headers(accessToken) });
            invoice = res.data?.Invoice;
            if (invoice) {
              invoiceId = id;
              console.log(
                `📄 Using invoice ID ${id} from ${cand.label} (fallback without enhancedAllCustomFields)`,
              );
              break;
            }
          } catch (inner) {
            console.log(
              `⚠️  Invoice ${id} from ${cand.label} failed (status=${inner.response?.status || "?"}). Trying next source...`,
            );
            continue;
          }
        }
        if (status === 404) {
          console.log(
            `📄 Invoice ${id} from ${cand.label} not found (404). Trying next source...`,
          );
          continue;
        }
        console.log(
          `⚠️  Invoice ${id} from ${cand.label} request error (status=${status || "?"}). Trying next source...`,
        );
      }
    }

    if (!invoice || !invoiceId) {
      throw new Error(
        "No invoice could be fetched (tried CLI/env override, 175, DB, and QBO).",
      );
    }
    console.log(
      "\n📋 Whole invoice (QBO response):",
      JSON.stringify(invoice, null, 2),
    );

    logInvoiceCustomFieldsTable(invoice);
    logMergedDefinitionsWithInvoiceValues(gqlDefs.list, invoice);

    let definitionId = extractSalesRepDefinitionId(invoice);
    if (!definitionId) {
      console.log(
        "\n📋 Invoice had no Sales Rep CustomField in response. Trying GraphQL list for Sales Rep name...",
      );
      definitionId = extractSalesRepDefinitionIdFromGraphQLList(gqlDefs.list);
      if (definitionId)
        console.log(
          `✅ Got Sales Rep DefinitionId from GraphQL: ${definitionId}`,
        );
    }
    if (!definitionId) {
      console.log(
        "\n⚠️ Could not detect Sales Rep DefinitionId. To detect it: in QBO open an invoice (e.g. 175), set the Sales Rep field to any value, save, then run this script again.",
      );
      console.log(
        "   Using fallback DefinitionId=1. If the value still does not appear on invoices, set QBO_SALES_REP_CUSTOM_FIELD_ID in .env to the correct ID from QBO.",
      );
      definitionId = "1";
    }

    console.log(`\n✅ Sales Rep DefinitionId: ${definitionId}`);
    updateEnvFile("QBO_SALES_REP_CUSTOM_FIELD_ID", definitionId);

    // -------------------------------------------------------------------
    // Pullout (PulloutIntentId) custom field detection on the SAME company
    // -------------------------------------------------------------------
    console.log("\n🔍 Detecting PulloutIntentId custom field DefinitionId...");

    let pulloutDefinitionId = extractPulloutDefinitionId(invoice);
    if (pulloutDefinitionId) {
      console.log(
        `✅ Pullout DefinitionId from chosen invoice (${invoiceId}): ${pulloutDefinitionId}`,
      );
    }

    if (!pulloutDefinitionId) {
      pulloutDefinitionId = extractPulloutDefinitionIdFromGraphQLList(gqlDefs.list);
      if (pulloutDefinitionId)
        console.log(
          `✅ Pullout DefinitionId from GraphQL definitions: ${pulloutDefinitionId}`,
        );
    }

    if (!pulloutDefinitionId) {
      const PULLOUT_SCAN_LIMIT = Math.max(
        1,
        parseInt(process.env.QBO_PULLOUT_SCAN_LIMIT || "50", 10),
      );
      const PULLOUT_SCAN_PAGE_SIZE = Math.max(
        1,
        Math.min(
          100,
          parseInt(process.env.QBO_PULLOUT_SCAN_PAGE_SIZE || "25", 10),
        ),
      );
      pulloutDefinitionId = await findPulloutDefinitionIdByScanningInvoices(
        accessToken,
        realmId,
        PULLOUT_SCAN_LIMIT,
        PULLOUT_SCAN_PAGE_SIZE,
      );
    }

    if (pulloutDefinitionId) {
      console.log(`\n✅ Pullout DefinitionId: ${pulloutDefinitionId}`);
      updateEnvFile("QBO_PULLOUT_CUSTOM_FIELD_ID", pulloutDefinitionId);
    } else {
      console.log(
        "\n⚠️ Could not detect PulloutIntentId DefinitionId. Skipping env write for QBO_PULLOUT_CUSTOM_FIELD_ID.",
      );
      console.log(
        "   Tip: in QBO open an invoice that has a PulloutIntentId value, save it, then re-run. Or increase QBO_PULLOUT_SCAN_LIMIT (default 50).",
      );
    }

    console.log("\n✅ Done. Restart the app to use the new env value(s).");
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    if (err.response?.data)
      console.error("   QBO response:", err.response.data);
    process.exit(1);
  } finally {
    await db.sequelize?.close?.();
  }
}

main();
