// services/qboItemService.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { QBO, MINOR, headers, qboQuery, qboQuote } = require("./qboHelpers");

/* ------------------------------------------------------------------
 * ENV + CACHE HELPERS
 * ------------------------------------------------------------------ */

function updateEnvIfMissing(key, value) {
  const envPath = path.resolve(process.cwd(), ".env");
  let envContent = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : "";

  if (!process.env[key]) {
    fs.appendFileSync(envPath, `\n${key}=${value}`);
    process.env[key] = value;
    console.log(`[QBO] Saved new env value ${key}=${value}`);
    return;
  }

  if (!envContent.includes(`${key}=`)) {
    fs.appendFileSync(envPath, `\n${key}=${value}`);
    process.env[key] = value;
  }
}

/* ------------------------------------------------------------------
 * ACCOUNT HELPERS
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
  let existing = process.env.QBO_INCOME_ACCOUNT_ID;

  if (existing) {
    console.log(`[QBO] Using income account from env: ${existing}`);
    return existing;
  }

  const found = await findAnyIncomeAccount({ accessToken, realmId });
  if (found?.Id) {
    updateEnvIfMissing("QBO_INCOME_ACCOUNT_ID", found.Id);
    return String(found.Id);
  }

  const created = await createIncomeAccount({ accessToken, realmId });
  updateEnvIfMissing("QBO_INCOME_ACCOUNT_ID", created.Id);
  return String(created.Id);
}

/* ------------------------------------------------------------------
 * ITEM HELPERS
 * ------------------------------------------------------------------ */

async function findItemByName({ accessToken, realmId, name }) {
  try {
    const sql = `select Id, Name from Item where Name = ${qboQuote(name)}`;
    const res = await qboQuery({ accessToken, realmId, query: sql });
    return res?.QueryResponse?.Item?.[0] || null;
  } catch (err) {
    console.warn("[QBO][findItemByName]", err.message);
    return null;
  }
}

async function createServiceItem({
  accessToken,
  realmId,
  name,
  incomeAccountId,
  taxable = false,
}) {
  console.log(`[QBO] Creating Item "${name}"...`);

  const payload = {
    Name: name,
    Type: "Extra Charges / Services",
    IncomeAccountRef: { value: String(incomeAccountId) },
    TrackQtyOnHand: false,
    Taxable: Boolean(taxable),
  };

  const url = `${QBO(realmId)}/item?minorversion=${MINOR}`;

  try {
    const res = await axios.post(url, payload, {
      headers: headers(accessToken),
    });

    const item = res?.data?.Item;
    console.log(`[QBO] ✅ Created item: ${item.Name} (${item.Id})`);
    return String(item.Id);
  } catch (err) {
    console.error(
      "[QBO][createServiceItem] Error:",
      err?.response?.status,
      JSON.stringify(err?.response?.data, null, 2)
    );
    throw new Error("Failed to create QBO item: " + err?.message);
  }
}

/* ------------------------------------------------------------------
 *  Ensure item (ENV → FIND → CREATE)
 * ------------------------------------------------------------------ */
async function ensureItem({
  accessToken,
  realmId,
  name,
  envKey,
  incomeAccountId,
}) {
  // 1. from env
  if (process.env[envKey]) {
    console.log(`[QBO] Using ${name} from env: ${process.env[envKey]}`);
    return process.env[envKey];
  }

  // 2. find in QBO
  const found = await findItemByName({ accessToken, realmId, name });
  if (found?.Id) {
    updateEnvIfMissing(envKey, found.Id);
    return String(found.Id);
  }

  // 3. create new
  const newId = await createServiceItem({
    accessToken,
    realmId,
    name,
    incomeAccountId,
    taxable: false,
  });

  updateEnvIfMissing(envKey, newId);
  return newId;
}

/* ------------------------------------------------------------------
 * PUBLIC: Warmup Loader (returns all 3 item IDs)
 * ------------------------------------------------------------------ */
async function warmupQBOResources({ accessToken, realmId }) {
  console.log("[QBO] Warm-up started...");

  const incomeAccountId = await ensureIncomeAccount({ accessToken, realmId });

  const productItemId = await ensureItem({
    accessToken,
    realmId,
    name: "Generic Coffee Product",
    envKey: "QBO_PRODUCT_ITEM_ID",
    incomeAccountId,
  });

  const serviceItemId = await ensureItem({
    accessToken,
    realmId,
    name: "Extra Charges / Services",
    envKey: "QBO_SERVICE_ITEM_ID",
    incomeAccountId,
  });

  const shippingItemId = await ensureItem({
    accessToken,
    realmId,
    name: "Shipping",
    envKey: "QBO_SHIPPING_ITEM_ID",
    incomeAccountId,
  });

  console.log("[QBO] ✅ Warm-up complete:", {
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
  findItemByName,
  createServiceItem,
  ensureItem,
};
