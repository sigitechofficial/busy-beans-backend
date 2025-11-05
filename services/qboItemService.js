const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { QBO, MINOR, headers, qboQuery, qboQuote } = require("./qboHelpers");

// --- Cached / persisted values ---
let cachedIncomeAccountId = process.env.QBO_INCOME_ACCOUNT_ID || null;
let cachedGenericItemId = process.env.QBO_GENERIC_ITEM_ID || null;

// --- Internal helper to update .env if missing or invalid ---
function updateEnv(key, value) {
  const envPath = path.resolve(process.cwd(), ".env");
  try {
    const envContent = fs.existsSync(envPath)
      ? fs.readFileSync(envPath, "utf8")
      : "";
    const regex = new RegExp(`^${key}=.*$`, "m");
    const newLine = `${key}=${value}`;
    if (regex.test(envContent)) {
      fs.writeFileSync(envPath, envContent.replace(regex, newLine));
    } else {
      fs.appendFileSync(envPath, `\n${newLine}`);
    }
    process.env[key] = value;
    console.log(`[QBO] Updated .env ${key}=${value}`);
  } catch (err) {
    console.warn(`[QBO] Failed to update .env for ${key}:`, err.message);
  }
}

/* ------------------------------------------------------------------
 *  ACCOUNT HELPERS
 * ------------------------------------------------------------------ */
async function findAccountById({ accessToken, realmId, id }) {
  const q = `select Id, Name, Active, AccountType from Account where Id='${id}'`;
  const res = await qboQuery({ accessToken, realmId, query: q });
  return res?.QueryResponse?.Account?.[0] || null;
}

async function findAnyIncomeAccount({ accessToken, realmId }) {
  const q = `select Id, Name from Account where AccountType='Income'`;
  const res = await qboQuery({ accessToken, realmId, query: q });
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
  return res.data?.Account;
}

/* ------------------------------------------------------------------
 *  Ensure Income Account
 * ------------------------------------------------------------------ */
async function ensureIncomeAccount({ accessToken, realmId }) {
  // 1️⃣ Validate cached or env-stored account
  if (cachedIncomeAccountId) {
    const acc = await findAccountById({
      accessToken,
      realmId,
      id: cachedIncomeAccountId,
    });
    if (acc && acc.Active) {
      console.log(
        `[QBO] Using valid cached Income Account ${acc.Name} (${acc.Id})`
      );
      return cachedIncomeAccountId;
    }
    console.warn(
      `[QBO] Cached Income Account ${cachedIncomeAccountId} invalid, will recreate`
    );
  }

  // 2️⃣ Try to find existing Income Account
  const found = await findAnyIncomeAccount({ accessToken, realmId });
  if (found?.Id) {
    cachedIncomeAccountId = String(found.Id);
    // updateEnv("QBO_INCOME_ACCOUNT_ID", cachedIncomeAccountId);
    console.log(`[QBO] Found Income Account ${found.Name} (${found.Id})`);
    return cachedIncomeAccountId;
  }

  // 3️⃣ Create one if none exist
  const created = await createIncomeAccount({ accessToken, realmId });
  if (created?.Id) {
    cachedIncomeAccountId = String(created.Id);
    // updateEnv("QBO_INCOME_ACCOUNT_ID", cachedIncomeAccountId);
    console.log(
      `[QBO] Created new Income Account ${created.Name} (${created.Id})`
    );
    return cachedIncomeAccountId;
  }

  throw new Error("Failed to ensure a valid Income Account in QuickBooks.");
}

/* ------------------------------------------------------------------
 *  Ensure Generic Service Item
 * ------------------------------------------------------------------ */
async function ensureServiceItem({
  accessToken,
  realmId,
  name,
  incomeAccountId,
  taxable = false,
}) {
  const findSql = `select Id, Name from Item where Name = ${qboQuote(name)}`;
  const res = await qboQuery({ accessToken, realmId, query: findSql });
  const found = res?.QueryResponse?.Item?.[0];
  if (found?.Id) {
    console.log(
      `[QBO] Found existing service item: ${found.Name} (${found.Id})`
    );
    return String(found.Id);
  }

  console.log(`[QBO] Creating new service item: ${name}`);
  const createUrl = `${QBO(realmId)}/item?minorversion=${MINOR}`;
  const payload = {
    Name: name,
    Type: "Service",
    IncomeAccountRef: { value: String(incomeAccountId) },
    TrackQtyOnHand: false,
    Taxable: Boolean(taxable),
  };

  try {
    const c = await axios.post(createUrl, payload, {
      headers: headers(accessToken),
    });
    const newItem = c.data?.Item;
    console.log(`[QBO] Created Item ${newItem?.Name} (${newItem?.Id})`);
    return newItem?.Id ? String(newItem.Id) : null;
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error(
      "[QBO][ensureServiceItem] Create failed:",
      status,
      JSON.stringify(data, null, 2)
    );
    throw new Error(
      `QuickBooks Item creation failed (${status}): ${
        data?.Fault?.Error?.[0]?.Message ||
        data?.Fault?.Error?.[0]?.Detail ||
        "Unknown"
      }`
    );
  }
}

/* ------------------------------------------------------------------
 * Warm-up helper: find or create and cache everything once
 * ------------------------------------------------------------------ */
async function warmupQBOResources({ accessToken, realmId }) {
  console.log("[QBO] Warm-up: ensuring Income Account and Generic Item...");
  const incomeAccountId = await ensureIncomeAccount({ accessToken, realmId });

  if (!cachedGenericItemId) {
    cachedGenericItemId = await ensureServiceItem({
      accessToken,
      realmId,
      name: "Generic Coffee Product",
      incomeAccountId,
      taxable: false,
    });
    updateEnv("QBO_GENERIC_ITEM_ID", cachedGenericItemId);
    console.log("✔ Cached GenericItemId =", cachedGenericItemId);
  }

  return {
    incomeAccountId,
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
