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

// Map local user → QBO Customer payload
function mapToQboCustomer(u) {
  return {
    DisplayName: u.companyName || `${u.srName || ""} ${u.territoryName || ""}`,
    PrimaryEmailAddr: u.email ? { Address: u.email } : undefined,
    GivenName: u.srName || u.name,
    CompanyName: u.companyName || `${u.srName} (Local Partner)`,
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

/**
 * Safely escape quotes for QuickBooks SQL.
 */
function escapeQboValue(str = "") {
  return str.replace(/'/g, "''").trim();
}

/**
 * Find existing QuickBooks customer by company or display name,
 * with fallback retries and clear debugging.
 */
// Robust "find or create" search that never 400s due to apostrophes

const formatPhone = (countryCode, number) => {
  if (!number) return undefined;
  // Normalize with country prefix if available
  const formatted = countryCode
    ? `+${countryCode.replace(/\D/g, "")} ${number}`
    : number;
  return { FreeFormNumber: formatted };
};
async function findQboCustomer({
  accessToken,
  realmId,
  email,
  companyName,
  displayName,
}) {
  const axios = require("axios");
  const safeName = (companyName || displayName || "").trim();
  const headers = { Authorization: `Bearer ${accessToken}` };
  const base =
    (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com";
  const QBO = (realmId) => `${base}/v3/company/${realmId}`;

  try {
    // 1️⃣ Try email match (most reliable, no apostrophe risk)
    if (email) {
      const emailUrl = `${QBO(realmId)}/query?query=select Id,DisplayName from Customer where PrimaryEmailAddr.Address='${email}'`;
      const r1 = await axios.get(emailUrl, { headers });
      if (r1.data?.QueryResponse?.Customer?.[0]) {
        const c = r1.data.QueryResponse.Customer[0];
        console.log(
          `[QBO][CustomerSearch] ✅ Found by email → ${c.DisplayName} (${c.Id})`
        );
        return c;
      }
    }

    // 2️⃣ Use QBO filter API (safer than SELECT)
    const filterUrl = `${QBO(realmId)}/customer?minorversion=70&DisplayName=${encodeURIComponent(safeName)}`;
    console.log(
      `[QBO][CustomerSearch] 🔍 Filtering customers by name: "${safeName}"`
    );

    const res = await axios.get(filterUrl, { headers });
    const customers =
      res.data?.QueryResponse?.Customer || res.data?.Customer || [];

    if (customers.length) {
      console.log(
        `[QBO][CustomerSearch] ✅ Found existing customer: ${customers[0].DisplayName} (ID=${customers[0].Id})`
      );
      return customers[0];
    }

    console.log(
      `[QBO][CustomerSearch] ❌ No existing customer found for "${safeName}"`
    );
    return null;
  } catch (err) {
    console.error(
      "[QBO][CustomerSearch] ❌ API search failed:",
      err.response?.data || err.message
    );
    return null;
  }
}

// 🚀 Main Import Function
async function importCustomersToQuickBooks({
  limitIds = [],
  userType = "customer",
}) {
  const { accessToken, realmId } = await refreshAccessTokenIfNeeded();
  if (!accessToken || !realmId) throw new Error("Missing QBO credentials");

  const where = { qboCustomerId: null };
  if (Array.isArray(limitIds) && limitIds.length) where.id = limitIds;

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
  const users = await MODEL.findAll({
    where,
    include,
  });

  console.log(
    `[QBO][CustomerImport] Found ${users.length} user(s) to import.`,
    JSON.parse(JSON.stringify(users))
  );

  const results = [];

  for (const u of users) {
    try {
      console.log(`\n-----------------------------`);
      console.log(`[QBO][Customer] Processing user ${u.id} (${u.email})`);

      // 1️⃣ Check for existing customer before create
      const existing = await findQboCustomer({
        accessToken,
        realmId,
        email: u.email,
        displayName:
          u.companyName || `${u.srName || ""} ${u.territoryName || ""}`,
      });

      console.log(`[QBO][Customer] Search result for ${u.email}:`, existing);

      if (existing?.Id) {
        const input = { qboCustomerId: existing?.Id };
        if (MODEL == user && u.salesRep.partnerType == "direct-partner") {
          input.qboCustomerIdForPartner = existing?.Id;
          delete input.qboCustomerId;
        }
        await MODEL.update(input, { where: { id: u.id } });
        console.log(
          `[QBO][Customer] ✅ Found existing: linked local user ${u.id} to QBO ${existing.Id}`
        );
        results.push({
          userId: u.id,
          qboCustomerId: existing.Id,
          status: "linked_existing",
        });
        continue;
      }

      // 2️⃣ No match found → create new
      const payload = mapToQboCustomer(u);
      console.log(`[QBO][Customer] Creating new QBO customer for ${u.email}`);
      const url = `${QBO(realmId)}/customer?minorversion=${MINOR}`;
      const res = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      const qboId = res.data?.Customer?.Id;
      if (qboId) {
        const input = { qboCustomerId: qboId };
        if (MODEL == user && u.salesRep.partnerType == "direct-partner") {
          input.qboCustomerIdForPartner = qboId;
          delete input.qboCustomerId;
        }
        await MODEL.update(input, { where: { id: u.id } });
        // await user.update({ qboCustomerId: qboId }, { where: { id: u.id } });
        console.log(`[QBO][Customer] 🆕 Created new QBO customer: ${qboId}`);
      }

      results.push({ userId: u.id, qboCustomerId: qboId, status: "created" });
    } catch (err) {
      const errRes = err.response?.data || {};
      const qboError = errRes?.Fault?.Error?.[0];
      const code = qboError?.code || "";
      const message = qboError?.Message || err.message;

      console.error(`[QBO][Customer] ❌ Error creating ${u.email}:`, {
        code,
        message,
        detail: qboError?.Detail,
        qboErrorRaw: JSON.stringify(qboError, null, 2),
      });

      // 🟡 If duplicate name, re-check and link
      if (code === "6240" || message.includes("Duplicate Name Exists")) {
        console.log(
          `[QBO][Customer] ⚠ Detected duplicate for ${u.email} — retrying search...`
        );
        const duplicate = await findQboCustomer({
          accessToken,
          realmId,
          email: u.email,
          displayName: u.companyName || u.name,
        });
        console.log(`[QBO][Customer] Duplicate lookup result:`, duplicate);

        if (duplicate?.Id) {
          const input = { qboCustomerId: duplicate.Id };
          if (MODEL == user && u.salesRep.partnerType == "direct-partner") {
            input.qboCustomerIdForPartner = duplicate.Id;
            delete input.qboCustomerId;
          }
          await MODEL.update(input, { where: { id: u.id } });
          console.log(
            `[QBO][Customer] 🔁 Linked duplicate customer ${duplicate.Id} for user ${u.id}`
          );
          results.push({
            userId: u.id,
            qboCustomerId: duplicate.Id,
            status: "linked_duplicate",
          });
          continue;
        } else {
          console.warn(
            `[QBO][Customer] ⚠ Duplicate name found, but no matching customer returned from QBO search!`
          );
        }
      }

      results.push({
        userId: u.id,
        status: "error",
        message,
        code,
        detail: qboError?.Detail || null,
      });
    }
  }

  console.log(
    `[QBO][CustomerImport] ✅ Completed import for ${results.length} user(s).`
  );
  return { imported: results.length, results };
}

module.exports = { importCustomersToQuickBooks };
