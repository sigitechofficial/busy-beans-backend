/**
 * One-off script: Fetch any QBO invoice, extract the Sales Rep custom field
 * DefinitionId, and update .env with QBO_SALES_REP_CUSTOM_FIELD_ID.
 *
 * Run: node scripts/fetchQboSalesRepDefinitionIdAndUpdateEnv.js
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

async function getSalesRepDefinitionIdViaGraphQL(accessToken) {
  try {
    const graphqlUrl = "https://qb.api.intuit.com/graphql";
    const query = `
      query {
        appFoundationsCustomFieldDefinitions {
          id
          name
          type
          legacyIdV2
        }
      }
    `;
    const response = await axios.post(
      graphqlUrl,
      { query },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      },
    );
    const list = response?.data?.data?.appFoundationsCustomFieldDefinitions;
    if (!Array.isArray(list)) return null;
    const salesRep = list.find(
      (f) =>
        f.name && /sales\s*rep|salesrep|local\s*partner/i.test(String(f.name)),
    );
    return salesRep?.legacyIdV2 ? String(salesRep.legacyIdV2) : null;
  } catch (e) {
    return null;
  }
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

function extractSalesRepDefinitionId(invoice) {
  const customFields = invoice?.CustomField || invoice?.CustomFields;
  if (!Array.isArray(customFields) || customFields.length === 0) return null;
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

function updateEnvFile(definitionId) {
  const envPath = path.resolve(__dirname, "../.env");
  let content = fs.readFileSync(envPath, "utf8");
  const key = "QBO_SALES_REP_CUSTOM_FIELD_ID";
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

    const PREFERRED_INVOICE_ID = "175";
    let invoiceId = null;
    try {
      const testUrl = `${QBO(realmId)}/invoice/${PREFERRED_INVOICE_ID}?minorversion=${MINOR}`;
      await axios.get(testUrl, { headers: headers(accessToken) });
      invoiceId = PREFERRED_INVOICE_ID;
      console.log(`📄 Using invoice ID ${PREFERRED_INVOICE_ID} from QBO`);
    } catch (e) {
      if (e.response?.status === 404)
        console.log(
          `📄 Invoice ${PREFERRED_INVOICE_ID} not found, trying other sources...`,
        );
    }
    if (!invoiceId) {
      const fromDb = await getOneInvoiceIdFromDb();
      if (fromDb && fromDb.invoiceId && fromDb.realmId) {
        invoiceId = fromDb.invoiceId;
        console.log(`📄 Using invoice ID from DB: ${invoiceId}`);
      }
    }
    if (!invoiceId) {
      invoiceId = await getOneInvoiceIdFromQbo(accessToken, realmId);
      console.log(`📄 Using first invoice from QBO: ${invoiceId}`);
    }
    if (!invoiceId) {
      throw new Error(
        "No invoice found (tried 175, DB, and QBO). Create at least one invoice in QuickBooks first.",
      );
    }

    // QBO returns CustomField when include=enhancedAllCustomFields is used (may require plan/scope)
    let getUrl = `${QBO(realmId)}/invoice/${invoiceId}?minorversion=${MINOR_WITH_CUSTOM_FIELDS}&include=enhancedAllCustomFields`;
    let res;
    try {
      res = await axios.get(getUrl, { headers: headers(accessToken) });
    } catch (e) {
      if (e.response?.status === 400) {
        getUrl = `${QBO(realmId)}/invoice/${invoiceId}?minorversion=${MINOR_WITH_CUSTOM_FIELDS}`;
        res = await axios.get(getUrl, { headers: headers(accessToken) });
      } else throw e;
    }
    let invoice = res.data?.Invoice;
    if (!invoice) throw new Error(`Invoice ${invoiceId} not found in QBO.`);
    console.log(
      "\n📋 Whole invoice (QBO response):",
      JSON.stringify(invoice, null, 2),
    );
    let customField = invoice.CustomField || invoice.CustomFields || [];
    console.log(
      "\n📋 Invoice CustomField(s):",
      JSON.stringify(customField, null, 2),
    );

    let definitionId = extractSalesRepDefinitionId(invoice);
    if (!definitionId) {
      console.log(
        "\n📋 Invoice had no CustomField in response. Trying GraphQL for Sales Rep definition...",
      );
      definitionId = await getSalesRepDefinitionIdViaGraphQL(accessToken);
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
    updateEnvFile(definitionId);
    console.log("\n✅ Done. Restart the app to use the new env value.");
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
