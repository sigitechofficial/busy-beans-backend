// controllers/quickbooks.js
// Stateless QuickBooks helpers: build auth URL, exchange redirect -> tokens,
// ping company info, and create a basic customer (no address).
// 🔊 Heavy console logs included (tokens are redacted).

const OAuthClient = require("intuit-oauth");
const axios = require("axios");

const ENV = process.env.QBO_ENV || "sandbox";
const HOST =
  ENV === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
const MINOR_VERSION = process.env.QBO_MINOR_VERSION || "75";

/* ------------------------------- logging utils ------------------------------ */
function red(s, head = 6, tail = 4) {
  if (!s || typeof s !== "string") return s;
  if (s.length <= head + tail) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
function logpfx(fn) {
  return `[QBO:${fn}]`;
}

/* --------------------------------- oauth ----------------------------------- */
function oc() {
  return new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID,
    clientSecret: process.env.QBO_CLIENT_SECRET,
    environment: ENV,
    redirectUri: process.env.QBO_REDIRECT_URI,
  });
}

/* ------------------------------ public helpers ----------------------------- */

// 1) Build authorization URL
exports.getAuthUrl = async (state) => {
  const s = state || `csrf-${Date.now()}`;
  const url = oc().authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: s,
  });
  console.log(logpfx("authUrl"), "ENV=", ENV, "HOST=", HOST, "state=", s);
  return url;
};
// 2) Exchange FULL redirect URL → tokens (no saving, just return)
exports.exchangeFromFullUrl = async (fullRedirectUrl) => {
  const tag = logpfx("exchange");
  console.log(tag, "incoming fullUrl=", fullRedirectUrl);

  if (
    !fullRedirectUrl ||
    !fullRedirectUrl.includes("code=") ||
    !fullRedirectUrl.includes("realmId=")
  ) {
    const err = new Error("fullUrl must contain ?code= and &realmId=");
    err.code = "QBO_BAD_REDIRECT_URL";
    console.error(tag, err.message);
    throw err;
  }

  const oauth = oc();
  try {
    const resp = await oauth.createToken(fullRedirectUrl);
    const t = resp.getJson();
    const realmId = oauth.getToken().realmId;

    console.log(
      tag,
      "SUCCESS exchange:",
      "realmId=",
      realmId,
      "access.len=",
      (t.access_token || "").length,
      "refresh.len=",
      (t.refresh_token || "").length,
      "expires_in=",
      t.expires_in,
      "x_refresh_expires_in=",
      t.x_refresh_token_expires_in
    );

    return {
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_in: t.expires_in,
      x_refresh_token_expires_in: t.x_refresh_token_expires_in,
      realmId,
    };
  } catch (e) {
    console.log(e);
    const st = e?.response?.status;
    const body = e?.response?.data;
    console.error(
      tag,
      "FAILED exchange:",
      "status=",
      st,
      "error=",
      body?.error,
      "desc=",
      body?.error_description,
      "fault=",
      JSON.stringify(body?.fault)
    );
    throw e;
  }
};

// 3) Ping company info (uses given token, NO refresh)
exports.getCompanyInfoWithToken = async (accessToken, realmId) => {
  const tag = logpfx("ping");
  const url = `${HOST}/v3/company/${realmId}/companyinfo/${realmId}?minorversion=${MINOR_VERSION}`;
  console.log(tag, "GET", url, "token=", red(accessToken));

  try {
    const { data, status, headers } = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      validateStatus: () => true,
    });
    console.log(
      tag,
      "RESP status=",
      status,
      "hasCompanyInfo=",
      !!data?.CompanyInfo
    );
    if (status >= 200 && status < 300) return data?.CompanyInfo || null;

    const wa = headers?.["www-authenticate"];
    console.error(
      tag,
      "ERR status=",
      status,
      "www-auth=",
      wa,
      "body=",
      JSON.stringify(data)
    );
    const err = new Error("Ping failed");
    err.httpStatus = status;
    err.body = data;
    throw err;
  } catch (e) {
    const st = e?.response?.status;
    const wa = e?.response?.headers?.["www-authenticate"];
    console.error(
      tag,
      "EXCEPTION status=",
      st,
      "www-auth=",
      wa,
      "body=",
      e?.response?.data || e?.message
    );
    throw e;
  }
};

const toQboAddr = (a) => {
  if (!a) return undefined; // undefined -> key omitted from JSON
  return {
    Line1: a.addressLineOne || undefined,
    Line2: a.addressLineTwo || undefined,
    City: a.town || undefined,
    CountrySubDivisionCode: a.state || undefined, // e.g. "FL"
    PostalCode: a.zipCode || undefined,
    Country: a.country || undefined,
  };
};
// pick first active (status && !deleted), else first available
const pickAddress = (list) =>
  list?.find((a) => a?.status && !a?.deleted) ?? list?.[0] ?? null;

// map our address shape -> QBO address shape

// map our address shape -> QBO address shape

// exports.createCustomerBasicWithToken = async (accessToken, realmId, u) => {
//   const tag = logpfx("createCustomer");
//   const url = `${HOST}/v3/company/${realmId}/customer?minorversion=${MINOR_VERSION}`;

//   const ship = pickAddress(u.addresses);
//   const bill = pickAddress(u.billingAddresses) ?? ship; // fallback to ship if billing missing

//   const body = {
//     DisplayName: u.companyName || u.name,
//     CompanyName: u.companyName || undefined,
//     GivenName: u.name || undefined,
//     PrimaryEmailAddr: u.email ? { Address: u.email } : undefined,
//     PrimaryPhone: u.phoneNumber ? { FreeFormNumber: u.phoneNumber } : undefined,
//     // ⬇️ NEW: addresses
//     BillAddr: toQboAddr(bill),
//     ShipAddr: toQboAddr(ship),
//   };
//   Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

//   console.log(tag, "POST", url, "token=", red(accessToken), "payload=", body);

//   try {
//     const { data, status, headers } = await axios.post(url, body, {
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//         Accept: "application/json",
//         "Content-Type": "application/json",
//       },
//       validateStatus: () => true,
//     });
//     const customerId = data?.Customer?.Id;
//     console.log(tag, "RESP status=", status, "customerId=", customerId);

//     if (status >= 200 && status < 300) return { id: customerId, raw: data };

//     const wa = headers?.["www-authenticate"];
//     console.error(
//       tag,
//       "ERR status=",
//       status,
//       "www-auth=",
//       wa,
//       "body=",
//       JSON.stringify(data)
//     );
//     const err0 = data?.fault?.error?.[0];
//     const err = new Error(err0?.message || "QBO error");
//     err.code = err0?.code || "QBO_ERROR";
//     err.detail = err0?.detail || data;
//     err.httpStatus = status;
//     throw err;
//   } catch (e) {
//     const st = e?.response?.status;
//     const wa = e?.response?.headers?.["www-authenticate"];
//     console.error(
//       tag,
//       "EXCEPTION status=",
//       st,
//       "www-auth=",
//       wa,
//       "body=",
//       e?.response?.data || e?.message
//     );
//     throw e;
//   }
// };

// Replace your function with this version
exports.createCustomerBasicWithToken = async (accessToken, realmId, u) => {
  const tag = logpfx("createCustomer");
  const url = `${HOST}/v3/company/${realmId}/customer?minorversion=${MINOR_VERSION}`;
  const qUrl = `${HOST}/v3/company/${realmId}/query?minorversion=${MINOR_VERSION}`;

  const ship = pickAddress(u.addresses);
  const bill = pickAddress(u.billingAddresses) ?? ship; // fallback

  const displayName = u.companyName || u.name;
  const email = (u.email || "").trim();

  // helpers
  const esc = (s) => String(s || "").replace(/'/g, "\\'");
  async function findCustomerIdByEmail() {
    if (!email) return null;
    const q = `select Id, DisplayName from Customer where PrimaryEmailAddr.Address = '${esc(email)}'`;
    const { data, status } = await axios.post(qUrl, q, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/text",
      },
      validateStatus: () => true,
    });
    if (status >= 200 && status < 300) {
      const row = data?.QueryResponse?.Customer?.[0];
      return row?.Id || null;
    }
    return null;
  }
  async function findCustomerIdByName() {
    if (!displayName) return null;
    const q = `select Id, DisplayName from Customer where DisplayName = '${esc(displayName)}'`;
    const { data, status } = await axios.post(qUrl, q, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/text",
      },
      validateStatus: () => true,
    });
    if (status >= 200 && status < 300) {
      const row = data?.QueryResponse?.Customer?.[0];
      return row?.Id || null;
    }
    return null;
  }

  // 0) pre-check by email, then by display name
  try {
    const preByEmail = await findCustomerIdByEmail();
    if (preByEmail) {
      console.log(tag, "Found existing by email:", email, "id=", preByEmail);
      return { id: preByEmail, created: false, raw: null };
    }
    const preByName = await findCustomerIdByName();
    if (preByName) {
      console.log(
        tag,
        "Found existing by DisplayName:",
        displayName,
        "id=",
        preByName
      );
      return { id: preByName, created: false, raw: null };
    }
  } catch (e) {
    // ignore precheck failures; we can still try create
    console.warn(tag, "precheck failed, will attempt create:", e?.message);
  }

  const body = {
    DisplayName: displayName,
    CompanyName: u.companyName || undefined,
    GivenName: u.name || undefined,
    PrimaryEmailAddr: email ? { Address: email } : undefined,
    PrimaryPhone: u.phoneNumber ? { FreeFormNumber: u.phoneNumber } : undefined,
    BillAddr: toQboAddr(bill),
    ShipAddr: toQboAddr(ship),
  };
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

  console.log(tag, "POST", url, "payload=", {
    DisplayName: body.DisplayName,
    CompanyName: body.CompanyName,
    GivenName: body.GivenName,
    hasEmail: !!email,
    hasPhone: !!u.phoneNumber,
    hasBill: !!body.BillAddr,
    hasShip: !!body.ShipAddr,
  });

  try {
    const { data, status, headers } = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });

    const customerId = data?.Customer?.Id;
    console.log(tag, "RESP status=", status, "customerId=", customerId);

    // Success path
    if (status >= 200 && status < 300 && customerId) {
      return { id: customerId, created: true, raw: data };
    }

    // If duplicate-name error (6240) → fetch by DisplayName and return that Id
    const errArr = data?.Fault?.Error || data?.fault?.error || [];
    const code = errArr?.[0]?.code || errArr?.[0]?.Code;
    const msg = errArr?.[0]?.Message || errArr?.[0]?.message || "";

    if (String(code) === "6240" || /duplicate/i.test(msg)) {
      // try to resolve existing by name (email pre-check was already tried)
      const idByName = await findCustomerIdByName();
      if (idByName) {
        console.log(tag, "Duplicate: returning existing id=", idByName);
        return { id: idByName, created: false, raw: null };
      }
    }

    // Other errors → throw
    const wa = headers?.["www-authenticate"];
    console.error(
      tag,
      "ERR status=",
      status,
      "www-auth=",
      wa,
      "body=",
      JSON.stringify(data)
    );
    const err0 = errArr?.[0] || {};
    const err = new Error(err0.message || err0.Message || "QBO error");
    err.code = code || "QBO_ERROR";
    err.detail = err0.detail || err0.Detail || data;
    err.httpStatus = status;
    throw err;
  } catch (e) {
    const st = e?.response?.status;
    const wa = e?.response?.headers?.["www-authenticate"];
    console.error(
      tag,
      "EXCEPTION status=",
      st,
      "www-auth=",
      wa,
      "body=",
      e?.response?.data || e?.message
    );
    throw e;
  }
};

/* =====================  QUERY + ENSURE HELPERS  ===================== */

async function createSimpleItem(
  accessToken,
  realmId,
  { baseName, type = "NonInventory", incomeAccountId }
) {
  if (!incomeAccountId) throw new Error("QBO_INCOME_ACCOUNT_ID missing");
  const url = `${HOST}/v3/company/${realmId}/item?minorversion=${MINOR_VERSION}`;

  // unique-ish name to avoid Duplicate Name error if you call many times
  const uniqueName = `${baseName} ${Date.now()}`;

  const payload = {
    Name: uniqueName,
    Type: type, // 'NonInventory' | 'Service'
    IncomeAccountRef: { value: String(incomeAccountId) },
    Active: true,
  };

  const { data, status } = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    validateStatus: () => true,
  });

  if (!(status >= 200 && status < 300)) {
    throw new Error(`[QBO:createItem] ${status}: ${JSON.stringify(data)}`);
  }
  const id = data?.Item?.Id;
  if (!id) throw new Error("Item created but no Id returned");
  return String(id);
}

// ---------- Helpers (missing in your snippet) ----------
const QBO = (realmId) =>
  `https://quickbooks.api.intuit.com/v3/company/${realmId}`;

async function qboPost({
  accessToken,
  url,
  data,
  contentType = "application/json",
}) {
  return axios.post(url, data, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
      Accept: "application/json",
    },
  });
}

async function qboQuery({ accessToken, realmId, query, minorversion = 70 }) {
  const url = `${QBO(realmId)}/query?minorversion=${minorversion}`;
  // QBO query endpoint expects raw text/sql, not JSON
  return qboPost({
    accessToken,
    url,
    data: query,
    contentType: "application/text",
  });
}

/** Find Account.Id by name (e.g. "Sales of Product Income" or "Sales") */
async function findAccountId({ accessToken, realmId, name }) {
  const safe = name.replace(/'/g, "\\'");
  const query = `select Id, Name from Account where Name = '${safe}'`;
  const res = await qboQuery({ accessToken, realmId, query });
  const rows = res.data?.QueryResponse?.Account || [];
  return rows[0]?.Id || null;
}

/** Ensure a Service Item exists; create if missing and return its Id */
async function ensureServiceItem({
  accessToken,
  realmId,
  name,
  incomeAccountId,
  taxable = false,
  minorversion = 70,
}) {
  const safeName = name.replace(/'/g, "\\'");
  // Try find by name
  const findQ = `select Id, Name from Item where Name = '${safeName}'`;
  const findRes = await qboQuery({
    accessToken,
    realmId,
    query: findQ,
    minorversion,
  });
  const found = (findRes.data?.QueryResponse?.Item || [])[0];
  if (found?.Id) return found.Id;

  if (!incomeAccountId) {
    throw new Error("incomeAccountId is required to create a new Item");
  }

  // Create Service item
  const url = `${QBO(realmId)}/item?minorversion=${minorversion}`;
  const payload = {
    Name: name,
    Type: "Service",
    IncomeAccountRef: { value: String(incomeAccountId) },
    TrackQtyOnHand: false,
    Taxable: Boolean(taxable),
  };
  const createRes = await qboPost({ accessToken, url, data: payload });
  return createRes.data?.Item?.Id;
}

/** Map your order.address → QBO ShipAddr */
function mapOrderAddressToQboShipAddr(order) {
  const a = order?.address || {};
  const ShipAddr = {
    Line1: a.addressLineOne || a.companyaddress || undefined,
    Line2: a.addressLineTwo || undefined,
    Line3: a.companyaddress ? `Attn: ${a.companyaddress}` : undefined, // optional
    City: a.town || a.city || undefined,
    CountrySubDivisionCode: a.state || undefined, // e.g., "Florida" or "FL"
    PostalCode: a.zipCode || undefined,
    Country: a.country || undefined,
  };
  Object.keys(ShipAddr).forEach(
    (k) => ShipAddr[k] === undefined && delete ShipAddr[k]
  );
  return Object.keys(ShipAddr).length ? ShipAddr : undefined;
}

// ---------- Your main function (now fully wired) ----------
exports.createCustomerBasicWithToken = async (accessToken, realmId, u) => {
  const tag = logpfx("createCustomer");
  const url = `${HOST}/v3/company/${realmId}/customer?minorversion=${MINOR_VERSION}`;
  const qUrl = `${HOST}/v3/company/${realmId}/query?minorversion=${MINOR_VERSION}`;

  const ship = pickAddress(u.addresses);
  const bill = pickAddress(u.billingAddresses) ?? ship;

  const displayName = u.companyName || u.name;
  const email = (u.email || "").trim();

  const esc = (s) => String(s || "").replace(/'/g, "\\'");
  async function findCustomerIdByEmail() {
    if (!email) return null;
    const q = `select Id, DisplayName from Customer where PrimaryEmailAddr.Address = '${esc(email)}'`;
    const { data, status } = await axios.post(qUrl, q, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/text",
      },
      validateStatus: () => true,
    });
    if (status >= 200 && status < 300) {
      const row = data?.QueryResponse?.Customer?.[0];
      return row?.Id || null;
    }
    return null;
  }
  async function findCustomerIdByName() {
    if (!displayName) return null;
    const q = `select Id, DisplayName from Customer where DisplayName = '${esc(displayName)}'`;
    const { data, status } = await axios.post(qUrl, q, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/text",
      },
      validateStatus: () => true,
    });
    if (status >= 200 && status < 300) {
      const row = data?.QueryResponse?.Customer?.[0];
      return row?.Id || null;
    }
    return null;
  }

  // 0) pre-check by email, then by display name
  try {
    const preByEmail = await findCustomerIdByEmail();
    if (preByEmail) {
      console.log(tag, "Found existing by email:", email, "id=", preByEmail);
      return { id: preByEmail, created: false, raw: null };
    }
    const preByName = await findCustomerIdByName();
    if (preByName) {
      console.log(
        tag,
        "Found existing by DisplayName:",
        displayName,
        "id=",
        preByName
      );
      return { id: preByName, created: false, raw: null };
    }
  } catch (e) {
    console.warn(tag, "precheck failed, will attempt create:", e?.message);
  }

  const body = {
    DisplayName: displayName,
    CompanyName: u.companyName || undefined,
    GivenName: u.name || undefined,
    PrimaryEmailAddr: email ? { Address: email } : undefined,
    PrimaryPhone: u.phoneNumber ? { FreeFormNumber: u.phoneNumber } : undefined,
    BillAddr: toQboAddr(bill),
    ShipAddr: toQboAddr(ship),
  };
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

  console.log(tag, "POST", url, "payload=", {
    DisplayName: body.DisplayName,
    CompanyName: body.CompanyName,
    GivenName: body.GivenName,
    hasEmail: !!email,
    hasPhone: !!u.phoneNumber,
    hasBill: !!body.BillAddr,
    hasShip: !!body.ShipAddr,
  });

  try {
    const { data, status, headers } = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });

    const customerId = data?.Customer?.Id;
    console.log(tag, "RESP status=", status, "customerId=", customerId);

    if (status >= 200 && status < 300 && customerId) {
      return { id: customerId, created: true, raw: data };
    }

    // Duplicate-name handling
    const errArr = data?.Fault?.Error || data?.fault?.error || [];
    const code = errArr?.[0]?.code || errArr?.[0]?.Code;
    const msg = errArr?.[0]?.Message || errArr?.[0]?.message || "";

    if (String(code) === "6240" || /duplicate/i.test(msg)) {
      const idByName = await findCustomerIdByName();
      if (idByName) {
        console.log(tag, "Duplicate: returning existing id=", idByName);
        return { id: idByName, created: false, raw: null };
      }
    }

    const wa = headers?.["www-authenticate"];
    console.error(
      tag,
      "ERR status=",
      status,
      "www-auth=",
      wa,
      "body=",
      JSON.stringify(data)
    );
    const err0 = errArr?.[0] || {};
    const err = new Error(err0.message || err0.Message || "QBO error");
    err.code = code || "QBO_ERROR";
    err.detail = err0.detail || err0.Detail || data;
    err.httpStatus = status;
    throw err;
  } catch (e) {
    const st = e?.response?.status;
    const wa = e?.response?.headers?.["www-authenticate"];
    console.error(
      tag,
      "EXCEPTION status=",
      st,
      "www-auth=",
      wa,
      "body=",
      e?.response?.data || e?.message
    );
    throw e;
  }
};
// exports.createInvoiceFromOrderJSON = async ({
//   accessToken,
//   realmId,
//   order,
//   billEmail,
//   genericItemName = "Coffee Sale",
//   shippingItemName = "Shipping",
//   incomeAccountName = "Sales of Product Income",
// }) => {
//   console.log(
//     `🚀 ~ {
//   accessToken,
//   realmId,
//   order,
//   billEmail,
// }:`,
//     {
//       accessToken,
//       realmId,
//       order,
//       billEmail,
//     }
//   );
//   if (!accessToken || !realmId) throw new Error("Missing accessToken/realmId");
//   if (!order) throw new Error("Missing order");

//   // 1) CustomerRef from order JSON
//   const customerId =
//     order.qboCustomerId ||
//     order.qboCustomerid ||
//     order.customerId ||
//     order.qbCustomerId ||
//     order.quickbooksCustomerId;
//   if (!customerId) throw new Error("qboCustomerId not found in order");

//   // 2) Ensure items/accounts (same as before)
//   let incomeAccountId =
//     (await findAccountId({ accessToken, realmId, name: incomeAccountName })) ||
//     (await findAccountId({ accessToken, realmId, name: "Sales" }));
//   if (!incomeAccountId) throw new Error("Could not find an Income account.");
//   const genericItemId = await ensureServiceItem({
//     accessToken,
//     realmId,
//     name: genericItemName,
//     incomeAccountId,
//     taxable: false,
//   });

//   // 3) Build lines (same logic as before)
//   const Lines = [];
//   const list = Array.isArray(order.items) ? order.items : [];
//   for (const it of list) {
//     const qty = +Number(it.qty || 1).toFixed(4);
//     const lineTotal = +Number(it.price || it.total || 0).toFixed(2);
//     const rate = qty > 0 ? +Number(lineTotal / qty).toFixed(4) : 0;
//     const desc = [
//       it.product || it.productName || "Coffee Product",
//       it.grind && `(${String(it.grind).trim()})`,
//       it.productCode && `Code: ${it.productCode}`,
//       it.singleUnitWeight && `Unit: ${it.singleUnitWeight}`,
//     ]
//       .filter(Boolean)
//       .join(" • ");

//     Lines.push({
//       Amount: +Number(qty * rate).toFixed(2),
//       Description: desc,
//       DetailType: "SalesItemLineDetail",
//       SalesItemLineDetail: {
//         ItemRef: { value: String(genericItemId) },
//         Qty: qty,
//         UnitPrice: rate,
//         TaxCodeRef: { value: "NON" },
//       },
//     });
//   }

//   // Shipping (if any)
//   const shippingAmt = +Number(order.shippingCharges || 0).toFixed(2);
//   if (shippingAmt > 0) {
//     const shippingItemId = await ensureServiceItem({
//       accessToken,
//       realmId,
//       name: shippingItemName,
//       incomeAccountId,
//       taxable: false,
//     });
//     Lines.push({
//       Amount: shippingAmt,
//       Description: order.shippingCompany || "Shipping",
//       DetailType: "SalesItemLineDetail",
//       SalesItemLineDetail: {
//         ItemRef: { value: String(shippingItemId) },
//         Qty: 1,
//         UnitPrice: shippingAmt,
//         TaxCodeRef: { value: "NON" },
//       },
//     });
//   }

//   if (Lines.length === 0) {
//     const total = +Number(order.totalBill || 0).toFixed(2);
//     Lines.push({
//       Amount: total,
//       Description: "Coffee Sale",
//       DetailType: "SalesItemLineDetail",
//       SalesItemLineDetail: {
//         ItemRef: { value: String(genericItemId) },
//         Qty: 1,
//         UnitPrice: total,
//         TaxCodeRef: { value: "NON" },
//       },
//     });
//   }

//   // Dates
//   const today = new Date();
//   const txnDate = today.toISOString().slice(0, 10);
//   const due = new Date(today);
//   const termDays = Number(order.termDays || 0);
//   if (termDays > 0) due.setDate(due.getDate() + termDays);
//   const dueDate = due.toISOString().slice(0, 10);

//   // ← HERE: map order.address → QBO ShipAddr
//   const ShipAddr = mapOrderAddressToQboShipAddr(order);

//   const payload = {
//     CustomerRef: { value: String(customerId) },
//     Line: Lines,
//     CurrencyRef: { value: "USD" },
//     DocNumber: order.invoiceNumber || undefined,
//     TxnDate: txnDate,
//     DueDate: dueDate,
//     PrivateNote: order.note || undefined,
//     BillEmail: billEmail ? { Address: billEmail } : undefined,
//     ShipAddr, // auto-filled from order.address
//     PONumber: order.poNumber || undefined,
//   };
//   Object.keys(payload).forEach(
//     (k) => payload[k] === undefined && delete payload[k]
//   );

//   const res = await axios.post(
//     `${QBO(realmId)}/invoice?minorversion=70`,
//     payload,
//     {
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//         "Content-Type": "application/json",
//         Accept: "application/json",
//       },
//     }
//   );

//   const inv = res.data?.Invoice || res.data;
//   return {
//     id: inv?.Id,
//     docNumber: inv?.DocNumber,
//     totalAmt: inv?.TotalAmt,
//     dueDate: inv?.DueDate,
//     raw: inv,
//   };
// };
