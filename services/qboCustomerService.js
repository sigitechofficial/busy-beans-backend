// services/qboCustomerService.js
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const {
  user,
  salesRep,
  address,
  billingAddress,
  qboCustomerMap,
  account,
} = require("../models");
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

async function upsertQboCustomer({
  u,
  accessToken,
  realmId,
  userType = "customer",
}) {
  try {
    if (!u || !accessToken || !realmId)
      throw new Error("Missing data for QBO customer sync");

    const displayName = getDisplayName(u);
    console.log(`[QBO][Customer] Using DisplayName: '${displayName}'`);

    // 1️⃣ Try to find existing customer in QBO
    const existing = await findQboCustomerByDisplayName({
      accessToken,
      realmId,
      displayName,
    });

    if (existing?.Id) {
      const qboCustomerId = existing.Id;
      const MODEL = userType === "local-partner" ? salesRep : user;

      const input = { qboCustomerId };
      if (MODEL === user && u.salesRep?.partnerType === "direct-partner") {
        input.qboCustomerIdForPartner = qboCustomerId;
        delete input.qboCustomerId;
      }

      await MODEL.update(input, { where: { id: u.id } });
      console.log(
        `[QBO][Customer] ✅ Linked existing QBO ${qboCustomerId} to user ${u.id}`
      );

      return qboCustomerId;
    }

    // 2️⃣ Not found → Create new QBO customer
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

    const qboCustomerId = r.data?.Customer?.Id;
    if (!qboCustomerId) throw new Error("Failed to create QBO customer");

    const MODEL = userType === "local-partner" ? salesRep : user;
    const input = { qboCustomerId };
    if (MODEL === user && u.salesRep?.partnerType === "direct-partner") {
      input.qboCustomerIdForPartner = qboCustomerId;
      delete input.qboCustomerId;
    }

    await MODEL.update(input, { where: { id: u.id } });
    console.log(`[QBO][Customer] 🆕 Created QBO customer ${qboCustomerId}`);

    return qboCustomerId;
  } catch (err) {
    console.error(`[QBO][Customer] ❌ upsertQboCustomer error:`, err.message);
    throw err; // let caller decide error handling
  }
}

// ✅ MAIN IMPORT FUNCTION (fixed, clean, consistent)
async function importCustomersToQuickBooks({
  limitIds = [],
  userType = "customer",
  req,
}) {
  const where = { qboCustomerId: null };
  if (limitIds.length) where.id = limitIds;

  const MODEL = userType === "local-partner" ? salesRep : user;
  const include = [
    { model: address, limit: 1 },
    { model: billingAddress, limit: 1 },
  ];

  let ADMIN = await account.findOne({});
  if (MODEL === user) {
    include.push({
      model: salesRep,
      attributes: [
        "id",
        "srName",
        "territoryName",
        "partnerType",
        "currentRealmId",
      ],
    });
  }

  const users = await MODEL.findAll({ where, include });

  console.log(
    `[QBO][CustomerImport] Found ${users.length} user(s) to import.`,
    JSON.parse(JSON.stringify(users))
  );

  const results = [];

  for (const u of users) {
    console.log(`\n-----------------------------`);
    console.log(`[QBO][Customer] Processing user ${u.id} (${u.email})`);

    try {
      // --- (1) Always export to ADMIN realm
      const adminCondition = {
        accountId: ADMIN?.id,
        realmId: ADMIN?.currentRealmId,
      };

      const adminCustomerId = await upsertQboCustomer({
        u,
        condition: adminCondition, // pass condition instead of token
        userType,
      });
      const adminInput = {
        ...adminCondition,
        qboCustomerId: adminCustomerId,
      };

      if (userType == "customer ") {
        adminInput.userId = u.id;
      } else {
        adminInput.salesRepId = u.id;
      }

      await qboCustomerMap.create(adminInput);
      results.push(adminInput);

      // --- (2) If customer belongs to a sales rep, export to partner too
      if (
        userType === "customer" &&
        u.salesRepId &&
        u.salesRep?.currentRealmId
      ) {
        try {
          const repCondition = {
            salesRepId: u.salesRepId,
            realmId: u.salesRep.currentRealmId,
          };

          const partnerCustomerId = await upsertQboCustomer({
            u,
            condition: repCondition,
            userType,
          });

          const partnerInput = {
            ...adminCondition,
            qboCustomerId: partnerCustomerId,
            userId: u?.id,
          };
          await qboCustomerMap.create(partnerInput);
          results.push(partnerInput);
        } catch (partnerErr) {
          console.warn(
            `[QBO][Customer] ⚠️ Partner sync failed for ${u.email}:`,
            partnerErr.message
          );
          // Don't break admin sync — continue
        }
      }
    } catch (adminErr) {
      console.error(
        `[QBO][Customer] ❌ Admin sync failed for ${u.email}:`,
        adminErr.message
      );
    }
  }

  console.log(
    `[QBO][CustomerImport] ✅ Completed import for ${results.length} user(s).`,
    results
  );

  return { imported: results.length, results };
}

module.exports = { importCustomersToQuickBooks };
