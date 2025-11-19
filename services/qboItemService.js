// services/qboItemService.js
const axios = require("axios");
const { QBO, MINOR, headers, qboQuery, qboQuote } = require("./qboHelpers");
const { handleQboError } = require("./qboErrorHandler");

/* ------------------------------------------------------------------
 *  NO MORE ENV — REALM-SAFE ITEM HANDLING
 * ------------------------------------------------------------------ */

async function findAnyIncomeAccount({ accessToken, realmId }) {
  const sql = `select Id, Name from Account where AccountType='Income'`;
  const res = await qboQuery({ accessToken, realmId, query: sql });
  return res?.QueryResponse?.Account?.[0] || null;
}

async function createIncomeAccount({ accessToken, realmId }) {
  const url = `${QBO(realmId)}/account?minorversion=${MINOR}`;
  const payload = {
    Name: "Sales of Product Income",
    AccountType: "Income",
    AccountSubType: "SalesOfProductIncome",
  };

  const res = await axios.post(url, payload, { headers: headers(accessToken) });
  return res?.data?.Account;
}

async function ensureIncomeAccount({ accessToken, realmId }) {
  try {
    const found = await findAnyIncomeAccount({ accessToken, realmId });
    if (found?.Id) return String(found.Id);

    const created = await createIncomeAccount({ accessToken, realmId });
    return String(created.Id);
  } catch (err) {
    handleQboError({
      err: err,
      context: `[QBO][ensureIncomeAccount] ⚠️ ensureIncomeAccount`,
    });
    throw err;
  }
}

/* ------------------------------------------------------------------
 * ITEM HELPERS (NO ENV)
 * ------------------------------------------------------------------ */

async function findItemByName({ accessToken, realmId, name }) {
  try {
    const sql = `select Id, Name from Item where Name = ${qboQuote(name)}`;
    const res = await qboQuery({ accessToken, realmId, query: sql });
    return res?.QueryResponse?.Item?.[0] || null;
  } catch (err) {
    handleQboError({
      err: err,
      context: `[QBO][findItemByName] ⚠️ findItemByName`,
    });
    return null;
  }
}

async function createServiceItem({
  accessToken,
  realmId,
  name,
  incomeAccountId,
}) {
  const payload = {
    Name: name,
    Type: "Service",
    IncomeAccountRef: { value: String(incomeAccountId) },
    TrackQtyOnHand: false,
    Taxable: false,
  };

  const url = `${QBO(realmId)}/item?minorversion=${MINOR}`;
  const res = await axios.post(url, payload, { headers: headers(accessToken) });

  return String(res?.data?.Item?.Id);
}

async function ensureItem({ accessToken, realmId, name, incomeAccountId }) {
  const found = await findItemByName({ accessToken, realmId, name });
  if (found?.Id) return String(found.Id);

  return await createServiceItem({
    accessToken,
    realmId,
    name,
    incomeAccountId,
  });
}

/* ------------------------------------------------------------------
 * MASTER FUNCTION — REALM SAFE
 * ------------------------------------------------------------------ */

async function warmupQBOResources({ accessToken, realmId }) {
  console.log(`[QBO][${realmId}] Warmup started`);

  const incomeAccountId = await ensureIncomeAccount({ accessToken, realmId });

  const productItemId = await ensureItem({
    accessToken,
    realmId,
    name: "Generic Coffee Product",
    incomeAccountId,
  });

  const serviceItemId = await ensureItem({
    accessToken,
    realmId,
    name: "Extra Charges / Services",
    incomeAccountId,
  });

  const shippingItemId = await ensureItem({
    accessToken,
    realmId,
    name: "Shipping",
    incomeAccountId,
  });

  console.log(`[QBO][${realmId}] Warm-up OK`, {
    incomeAccountId,
    productItemId,
    serviceItemId,
    shippingItemId,
  });

  return {
    incomeAccountId,
    productItemId,
    serviceItemId,
    shippingItemId,
  };
}

module.exports = {
  warmupQBOResources,
};
