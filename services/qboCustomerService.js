// services/qboCustomerService.js
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { user, salesRep, address, billingAddress } = require("../models");
const axios = require("axios");

const BASE =
  (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const QBO = (realmId) => `${BASE}/v3/company/${realmId}`;
const MINOR = 70;

// ✅ FINAL — DISPLAY NAME FUNCTION (core logic)
function getDisplayName(u) {
  // ✅ Customer → use companyName
  if (u.companyName) return u.companyName.trim();

  // ✅ Local-partner → srName + territoryName
  const sn = (u.srName || "").trim();
  const tn = (u.territoryName || "").trim();
  const combined = `${sn} ${tn}`.trim();
  if (combined) return combined;

  // ✅ fallback (kabhi empty na ho)
  return (u.email || "").trim();
}

// ✅ Map local user → QBO Customer payload
function mapToQboCustomer(u) {
  return {
    DisplayName: getDisplayName(u), // ✅ ALWAYS CONSISTENT
    PrimaryEmailAddr: u.email ? { Address: u.email } : undefined,
    GivenName: u.name,
    CompanyName: u.companyName || undefined,
    PrimaryPhone: formatPhone(u.countryCode, u.phoneNumber),

    BillAddr: u.billingAddresses?.[0]
      ? {
          Line1: u.billingAddresses[0].addressLineOne,
          Line2: u.billingAddresses[0].addressLineTwo,
          City: u.billingAddresses[0].city,
          CountrySubDivisionCode: u.billingAddresses[0].state,
          PostalCode: u.billingAddresses[0].zipCode,
          Country: u.billingAddresses[0].country,
        }
      : undefined,

    ShipAddr: u.addresses?.[0]
      ? {
          Line1: u.addresses[0].addressLineOne,
          Line2: u.addresses[0].addressLineTwo,
          City: u.addresses[0].city,
          CountrySubDivisionCode: u.addresses[0].state,
          PostalCode: u.addresses[0].zipCode,
          Country: u.addresses[0].country,
        }
      : undefined,
  };
}

function escapeQboValue(str = "") {
  return str.replace(/'/g, "''").trim();
}

const formatPhone = (countryCode, number) => {
  if (!number) return undefined;
  const formatted = countryCode
    ? `+${countryCode.replace(/\D/g, "")} ${number}`
    : number;
  return { FreeFormNumber: formatted };
};

// ✅ **ONLY DISPLAYNAME SEARCH** (as you ordered)
async function findQboCustomerByDisplayName({
  accessToken,
  realmId,
  displayName,
}) {
  const headers = { Authorization: `Bearer ${accessToken}` };

  if (!displayName) return null;

  const safe = escapeQboValue(displayName);

  const q = encodeURIComponent(
    `select Id, DisplayName from Customer where DisplayName='${safe}'`
  );

  const url = `${QBO(realmId)}/query?query=${q}&minorversion=${MINOR}`;

  const r = await axios.get(url, {
    headers,
    validateStatus: () => true,
  });

  const found = r.data?.QueryResponse?.Customer?.[0];

  console.log("🚀 ~ findQboCustomerByDisplayName:", found);

  return found || null;
}

// ✅ MAIN IMPORT FUNCTION (fixed, clean, consistent)
async function importCustomersToQuickBooks({
  limitIds = [],
  userType = "customer",
}) {
  const { accessToken, realmId } = await refreshAccessTokenIfNeeded();
  if (!accessToken || !realmId) throw new Error("Missing QBO credentials");

  const where = { qboCustomerId: null };
  if (limitIds.length) where.id = limitIds;

  const MODEL = userType == "local-partner" ? salesRep : user;
  const include = [
    { model: address, limit: 1 },
    { model: billingAddress, limit: 1 },
  ];

  if (MODEL === user) {
    include.push({
      model: salesRep,
      attributes: ["id", "srName", "territoryName", "partnerType"],
    });
  }

  const users = await MODEL.findAll({ where, include });

  console.log(
    `[QBO][CustomerImport] Found ${users.length} user(s) to import.`,
    JSON.parse(JSON.stringify(users))
  );

  const results = [];

  for (const u of users) {
    try {
      console.log(`\n-----------------------------`);
      console.log(`[QBO][Customer] Processing user ${u.id} (${u.email})`);

      const displayName = getDisplayName(u);
      console.log(`[QBO][Customer] Using DisplayName: '${displayName}'`);

      // ✅ 1 — Search by DisplayName
      const existing = await findQboCustomerByDisplayName({
        accessToken,
        realmId,
        displayName,
      });

      console.log(
        `[QBO][Customer] Search result for '${displayName}':`,
        existing
      );

      // ✅ If exists → update DB only
      if (existing?.Id) {
        const input = { qboCustomerId: existing.Id };

        if (MODEL === user && u.salesRep?.partnerType === "direct-partner") {
          input.qboCustomerIdForPartner = existing.Id;
          delete input.qboCustomerId;
        }

        await MODEL.update(input, { where: { id: u.id } });

        console.log(
          `[QBO][Customer] ✅ Linked existing QBO ${existing.Id} to user ${u.id}`
        );

        results.push({
          userId: u.id,
          qboCustomerId: existing.Id,
          status: "linked_existing",
        });

        continue;
      }

      // ✅ 2 — Not found → Create new
      console.log(
        `[QBO][Customer] Creating new QBO customer for '${displayName}'`
      );

      const payload = mapToQboCustomer(u);
      const url = `${QBO(realmId)}/customer?minorversion=${MINOR}`;

      const r = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      const qboId = r.data?.Customer?.Id;

      if (qboId) {
        const input = { qboCustomerId: qboId };

        if (MODEL === user && u.salesRep?.partnerType === "direct-partner") {
          input.qboCustomerIdForPartner = qboId;
          delete input.qboCustomerId;
        }

        await MODEL.update(input, { where: { id: u.id } });

        console.log(`[QBO][Customer] 🆕 Created QBO customer ${qboId}`);
      }

      results.push({
        userId: u.id,
        qboCustomerId: qboId,
        status: "created",
      });
    } catch (err) {
      console.error(
        `[QBO][Customer] ❌ Error creating ${u.email}:`,
        err.message
      );

      results.push({
        userId: u.id,
        status: "error",
        message: err.message,
      });
    }
  }

  console.log(
    `[QBO][CustomerImport] ✅ Completed import for ${results.length} user(s).`
  );

  return { imported: results.length, results };
}

module.exports = { importCustomersToQuickBooks };
