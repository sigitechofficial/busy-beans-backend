// services/qboItemService.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { QBO, MINOR, headers, qboQuery, qboQuote } = require("./qboHelpers");

// --- Cached / persisted values ---
let cachedIncomeAccountId = process.env.QBO_INCOME_ACCOUNT_ID || null;
let cachedGenericItemId = process.env.QBO_GENERIC_ITEM_ID || null;

// --- Internal helper to append new keys to .env ---
function updateEnvIfMissing(key, value) {
  const envPath = path.resolve(process.cwd(), ".env");
  try {
    const envContent = fs.existsSync(envPath)
      ? fs.readFileSync(envPath, "utf8")
      : "";
    if (!envContent.includes(`${key}=`)) {
      fs.appendFileSync(envPath, `\n${key}=${value}`);
      console.log(`[QBO] Added ${key}=${value} to .env`);
    }
  } catch (err) {
    console.warn(`[QBO] Failed to update .env for ${key}:`, err.message);
  }
}

/* ------------------------------------------------------------------
 * Utility: find account by name
 * ------------------------------------------------------------------ */
async function findAccountId({ accessToken, realmId, name }) {
  const sql = `select Id, Name from Account where Name = ${qboQuote(name)}`;
  const res = await qboQuery({ accessToken, realmId, query: sql });
  const acct = res.data?.QueryResponse?.Account?.[0];
  return acct?.Id ? String(acct.Id) : null;
}

async function findIncomeAccountIdByScan({ accessToken, realmId, name }) {
  const sql = `select Id, Name from Account where AccountType='Income'`;
  const res = await qboQuery({ accessToken, realmId, query: sql });
  const list = res.data?.QueryResponse?.Account || [];
  const found = list.find(
    (a) => a.Name?.toLowerCase() === String(name).toLowerCase()
  );
  return found?.Id ? String(found.Id) : null;
}

async function findAnyIncomeAccountId({ accessToken, realmId }) {
  const sql = `select Id, Name from Account where AccountType='Income'`;
  const res = await qboQuery({ accessToken, realmId, query: sql });
  const acct = res.data?.QueryResponse?.Account?.[0];
  return acct?.Id ? String(acct.Id) : null;
}

async function createIncomeAccount({ accessToken, realmId, name }) {
  const createUrl = `${QBO(realmId)}/account?minorversion=${MINOR}`;
  const payload = {
    Name: name,
    AccountType: "Income",
    AccountSubType: "SalesOfProductIncome",
  };
  const res = await axios.post(createUrl, payload, {
    headers: headers(accessToken),
  });
  return res.data?.Account?.Id ? String(res.data.Account.Id) : null;
}

/* ------------------------------------------------------------------
 * Main: ensure Income Account
 * ------------------------------------------------------------------ */
async function ensureIncomeAccount({
  accessToken,
  realmId,
  preferredNames = [
    "Sales of Product Income",
    "Sales",
    "Product Sales",
    "Services",
    "Service/Fee Income",
  ],
}) {
  for (const nm of preferredNames) {
    const id = await findAccountId({ accessToken, realmId, name: nm });
    if (id) return id;
  }
  for (const nm of preferredNames) {
    const id = await findIncomeAccountIdByScan({
      accessToken,
      realmId,
      name: nm,
    });
    if (id) return id;
  }
  const anyId = await findAnyIncomeAccountId({ accessToken, realmId });
  if (anyId) return anyId;
  const created = await createIncomeAccount({
    accessToken,
    realmId,
    name: "Sales of Product Income",
  });
  if (created) return created;
  throw new Error("No Income account available and creation failed.");
}

/* ------------------------------------------------------------------
 * Main: ensure Generic Service Item
 * ------------------------------------------------------------------ */
async function ensureServiceItem({
  accessToken,
  realmId,
  name,
  incomeAccountId,
  taxable = false,
}) {
  const findSql = `select Id, Name from Item where Name = ${qboQuote(name)}`;
  const f = await qboQuery({ accessToken, realmId, query: findSql });
  const found = f.data?.QueryResponse?.Item?.[0];
  if (found?.Id) return String(found.Id);

  const createUrl = `${QBO(realmId)}/item?minorversion=${MINOR}`;
  const payload = {
    Name: name,
    Type: "Service",
    IncomeAccountRef: { value: String(incomeAccountId) },
    TrackQtyOnHand: false,
    Taxable: Boolean(taxable),
  };
  const c = await axios.post(createUrl, payload, {
    headers: headers(accessToken),
  });
  return c.data?.Item?.Id ? String(c.data.Item.Id) : null;
}

/* ------------------------------------------------------------------
 * Warm-up helper: find or create and cache everything once
 * ------------------------------------------------------------------ */
async function warmupQBOResources({ accessToken, realmId }) {
  console.log("[QBO] Warm-up: ensuring Income Account and Generic Item...");
  if (!cachedIncomeAccountId) {
    cachedIncomeAccountId = await ensureIncomeAccount({ accessToken, realmId });
    updateEnvIfMissing("QBO_INCOME_ACCOUNT_ID", cachedIncomeAccountId);
    console.log("✔ Cached IncomeAccountId =", cachedIncomeAccountId);
  }
  if (!cachedGenericItemId) {
    cachedGenericItemId = await ensureServiceItem({
      accessToken,
      realmId,
      name: "Generic Coffee Product",
      incomeAccountId: cachedIncomeAccountId,
      taxable: false,
    });
    updateEnvIfMissing("QBO_GENERIC_ITEM_ID", cachedGenericItemId);
    console.log("✔ Cached GenericItemId =", cachedGenericItemId);
  }
  return {
    incomeAccountId: cachedIncomeAccountId,
    genericItemId: cachedGenericItemId,
  };
}

/* ------------------------------------------------------------------
 * Exports
 * ------------------------------------------------------------------ */
module.exports = {
  ensureIncomeAccount,
  ensureServiceItem,
  warmupQBOResources,
};
