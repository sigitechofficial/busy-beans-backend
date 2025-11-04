// services/qboCustomerService.js
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { user, address, billingAddress } = require("../models");
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
    DisplayName: u.companyName || u.name,
    PrimaryEmailAddr: u.email ? { Address: u.email } : undefined,
    GivenName: u.name,
    CompanyName: u.companyName || undefined,
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

// --- Main bulk import ---
async function importCustomersToQuickBooks({ limitIds = [] }) {
  const { accessToken, realmId } = await refreshAccessTokenIfNeeded();
  if (!accessToken || !realmId) throw new Error("Missing QBO credentials");

  const where = { qboCustomerId: null };
  if (Array.isArray(limitIds) && limitIds.length) where.id = limitIds;

  const users = await user.findAll({
    where,
    include: [
      { model: address, limit: 1 },
      { model: billingAddress, limit: 1 },
    ],
  });

  const results = [];
  for (const u of users) {
    try {
      const payload = mapToQboCustomer(u);
      const url = `${QBO(realmId)}/customer?minorversion=${MINOR}`;
      const res = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      const qboId = res.data?.Customer?.Id;
      if (qboId) await u.update({ qboCustomerId: qboId });

      results.push({ userId: u.id, qboCustomerId: qboId, status: "ok" });
      console.log(`[QBO][Customer] Imported user ${u.id} → QBO ${qboId}`);
    } catch (err) {
      console.error(`[QBO][Customer] Failed for user ${u.id}:`, err.message);
      results.push({ userId: u.id, status: "error", message: err.message });
    }
  }

  return { imported: results.length, results };
}

module.exports = { importCustomersToQuickBooks };
