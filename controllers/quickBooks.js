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
    redirectUri: process.env.QBO_REDIRECT_URI, // MUST match Intuit Dev (Development) exactly
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
    const { data, status } = await axios.get(url, {
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

    const wa = e?.response?.headers?.["www-authenticate"];
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
// pick first active (status && !deleted), else first available
const pickAddress = (list) =>
  list?.find((a) => a?.status && !a?.deleted) ?? list?.[0] ?? null;

// map our address shape -> QBO address shape
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
// 4) Create basic Customer (DisplayName/CompanyName/PrimaryEmailAddr only)
exports.createCustomerBasicWithToken = async (accessToken, realmId, u) => {
  const tag = logpfx("createCustomer");
  const url = `${HOST}/v3/company/${realmId}/customer?minorversion=${MINOR_VERSION}`;

  const ship = pickAddress(u.addresses);
  const bill = pickAddress(u.billingAddresses) ?? ship; // fallback to ship if billing missing

  const body = {
    DisplayName: u.companyName || u.name,
    CompanyName: u.companyName || undefined,
    GivenName: u.name || undefined,
    PrimaryEmailAddr: u.email ? { Address: u.email } : undefined,
    PrimaryPhone: u.phoneNumber ? { FreeFormNumber: u.phoneNumber } : undefined,
    // ⬇️ NEW: addresses
    BillAddr: toQboAddr(bill),
    ShipAddr: toQboAddr(ship),
  };
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

  console.log(tag, "POST", url, "token=", red(accessToken), "payload=", body);

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

    if (status >= 200 && status < 300) return { id: customerId, raw: data };

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
    const err0 = data?.fault?.error?.[0];
    const err = new Error(err0?.message || "QBO error");
    err.code = err0?.code || "QBO_ERROR";
    err.detail = err0?.detail || data;
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

// low-level SELECT query

// get an Income account to attach to Items we create
async function ensureIncomeAccountId(accessToken, realmId) {
  // Prefer SalesOfProductIncome
  let qr = await qboQuery(
    accessToken,
    realmId,
    "SELECT Id, Name, AccountType FROM Account WHERE AccountType = 'SalesOfProductIncome' STARTPOSITION 1 MAXRESULTS 1"
  );
  let acc = qr?.Account?.[0];
  if (!acc) {
    // fall back to any Income
    qr = await qboQuery(
      accessToken,
      realmId,
      "SELECT Id, Name, AccountType FROM Account WHERE AccountType = 'Income' STARTPOSITION 1 MAXRESULTS 1"
    );
    acc = qr?.Account?.[0];
  }
  if (!acc?.Id)
    throw new Error("No Income account found in QBO (needed to create Items)");
  return String(acc.Id);
}

/// ---- PASTE INTO controllers/quickbooks.js ----
// Requires: axios, HOST, MINOR_VERSION, and your existing red(), logpfx()

/**
 * Create a simple QBO Item (NonInventory/Service) using a known Income account.
 * No queries; creates with a unique Name every time (avoids duplicate-name errors).
 */
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

/**
 * Create an invoice using ONLY the order payload (no item ids).
 * - Creates 1 "Generic Product" item (NonInventory) for products
 * - Creates "Shipping Charges" (Service) if shipping > 0
 * - Creates "VAT" (Service) if vat > 0
 * - Sets DocNumber from order.invoiceNumber (if provided)
 * - Verifies sum(items) + shipping + vat == totalBill (adds rounding adj if within 0.02)
 */
exports.createInvoiceFromOrderNoQuery = async (accessToken, realmId, order) => {
  const tag = logpfx("createInvoiceNoQuery");
  const toNum = (v, d = 0) => (v == null || v === "" ? d : Number(v));
  const round2 = (n) => Number((Math.round(n * 100) / 100).toFixed(2));

  const incomeAccountId = process.env.QBO_INCOME_ACCOUNT_ID;
  if (!incomeAccountId)
    throw new Error(
      "Set env QBO_INCOME_ACCOUNT_ID to a valid Income account Id"
    );

  const customerId = order?.qboCustomerId ?? order?.user?.qboCustomerId;
  if (!customerId)
    throw new Error(
      "qboCustomerId missing on order (order.qboCustomerId or order.user.qboCustomerId)"
    );

  // Create minimal items (unique names each call; avoids Duplicate Name errors without queries)
  const productItemId = await createSimpleItem(accessToken, realmId, {
    baseName: "Generic Product",
    type: "NonInventory",
    incomeAccountId,
  });
  let shippingItemId = null;
  let vatItemId = null;
  let roundingItemId = null;

  // Build lines
  const lines = [];
  let computedSubtotal = 0;

  for (const it of order.items || []) {
    const qty = Math.max(1, toNum(it.qty, 1));
    const lineTotal = round2(toNum(it.price, 0)); // you store TOTAL for the line
    const unit = qty ? round2(lineTotal / qty) : 0;

    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: lineTotal,
      Description: it.product || it.productName || it.productCode || "Item",
      SalesItemLineDetail: {
        ItemRef: { value: productItemId },
        Qty: qty,
        UnitPrice: unit,
      },
    });
    computedSubtotal += lineTotal;
  }

  const shipping = round2(toNum(order.shippingCharges, 0));
  if (shipping > 0) {
    shippingItemId = await createSimpleItem(accessToken, realmId, {
      baseName: "Shipping Charges",
      type: "Service",
      incomeAccountId,
    });
    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: shipping,
      Description: "Shipping Charges",
      SalesItemLineDetail: {
        ItemRef: { value: shippingItemId },
        Qty: 1,
        UnitPrice: shipping,
      },
    });
  }

  const vat = round2(toNum(order.vat, 0));
  if (vat > 0) {
    vatItemId = await createSimpleItem(accessToken, realmId, {
      baseName: "VAT",
      type: "Service",
      incomeAccountId,
    });
    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: vat,
      Description: "VAT",
      SalesItemLineDetail: {
        ItemRef: { value: vatItemId },
        Qty: 1,
        UnitPrice: vat,
      },
    });
  }

  // Optional: match totalBill (with tiny rounding adjustment)
  const expectedTotal = round2(toNum(order.totalBill, 0));
  const currentTotal = round2(computedSubtotal + shipping + vat);
  let delta = round2(expectedTotal - currentTotal);

  if (expectedTotal > 0 && Math.abs(delta) > 0) {
    if (Math.abs(delta) <= 0.02) {
      // add rounding line
      roundingItemId = await createSimpleItem(accessToken, realmId, {
        baseName: "Rounding Adjustment",
        type: "Service",
        incomeAccountId,
      });
      const adj = Math.abs(delta);
      lines.push({
        DetailType: "SalesItemLineDetail",
        Amount: adj,
        Description: "Rounding Adjustment",
        SalesItemLineDetail: {
          ItemRef: { value: roundingItemId },
          Qty: 1,
          UnitPrice: adj,
        },
      });
      delta = 0;
    } else {
      throw new Error(
        `totalBill mismatch: expected=${expectedTotal}, computed=${currentTotal}, delta=${(expectedTotal - currentTotal).toFixed(2)}`
      );
    }
  }

  const body = {
    CustomerRef: { value: String(customerId) },
    DocNumber: order.invoiceNumber || undefined,
    BillEmail: order.email ? { Address: order.email } : undefined,
    CurrencyRef: order.currency ? { value: order.currency } : undefined,
    PrivateNote: order.note || undefined,
    DueDate: order.dueDate || undefined,
    Line: lines,
  };
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

  const url = `${HOST}/v3/company/${realmId}/invoice?minorversion=${MINOR_VERSION}`;
  console.log(
    tag,
    "POST",
    url,
    "doc#=",
    body.DocNumber,
    "lines=",
    lines.length,
    "token=",
    red(accessToken)
  );

  const { data, status, headers } = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    validateStatus: () => true,
  });

  if (!(status >= 200 && status < 300)) {
    const wa = headers?.["www-authenticate"];
    console.error(
      tag,
      "ERR",
      status,
      "www-auth=",
      wa,
      "body=",
      JSON.stringify(data)
    );
    const e0 = data?.Fault?.Error?.[0] || data?.fault?.error?.[0];
    const err = new Error(e0?.Message || e0?.message || "QBO error");
    err.code = e0?.code || e0?.Code || "QBO_ERROR";
    err.detail = e0?.Detail || e0?.detail || data;
    err.httpStatus = status;
    throw err;
  }

  const invId = data?.Invoice?.Id;
  return { id: invId, raw: data };
};
