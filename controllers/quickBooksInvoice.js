// services/qboInvoice.min.js
const axios = require("axios");
const { or } = require("sequelize");

// ---- Base (QBO_ENV=sandbox for sandbox; anything else => prod) ----
const BASE =
  (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const QBO = (realmId) => `${BASE}/v3/company/${realmId}`;
const MINOR = 70;

// ---- helpers ----
// QBO SQL string literal must escape single quotes as ''
const qboQuote = (s) =>
  `'${String(s ?? "")
    .trim()
    .replace(/'/g, "''")}'`;

// ---- tiny HTTP helpers (no refresh/probe) ----
async function qboGet({ accessToken, realmId, path }) {
  const url = `${QBO(realmId)}${path}`;
  return axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
}

// Use **GET** with ?query= (URL-encoded) — most robust on production
async function qboQuery({ accessToken, realmId, query }) {
  const url = `${QBO(realmId)}/query?minorversion=${MINOR}&query=${encodeURIComponent(
    query
  )}`;
  // Optional debug: exact SQL
  console.log("[QBO][QL] ->", query);
  return axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
}

// ---- lookups / ensure ----

// Exact name match (no lower()), on parse error we’ll just let it return null
async function findAccountId({ accessToken, realmId, name }) {
  if (!name) return null;
  const sql =
    `select Id, Name, AccountType, AccountSubType from Account ` +
    `where Name = ${qboQuote(name)} and Active = true`;
  const r = await qboQuery({ accessToken, realmId, query: sql });
  const row = r.data?.QueryResponse?.Account?.[0];
  return row?.Id ? String(row.Id) : null;
}

// Scan Income accounts and match in JS (case-insensitive)
async function findIncomeAccountIdByScan({ accessToken, realmId, name }) {
  const target = String(name || "")
    .trim()
    .toLowerCase();
  if (!target) return null;
  const sql = `select Id, Name from Account where AccountType = 'Income' and Active = true STARTPOSITION 1 MAXRESULTS 200`;
  const r = await qboQuery({ accessToken, realmId, query: sql });
  const list = r.data?.QueryResponse?.Account || [];
  const hit = list.find(
    (a) =>
      String(a.Name || "")
        .trim()
        .toLowerCase() === target
  );
  return hit?.Id ? String(hit.Id) : null;
}

async function findAnyIncomeAccountId({ accessToken, realmId }) {
  const sql = `select Id, Name from Account where AccountType = 'Income' and Active = true STARTPOSITION 1 MAXRESULTS 1`;
  const r = await qboQuery({ accessToken, realmId, query: sql });
  const row = r.data?.QueryResponse?.Account?.[0];
  return row?.Id ? String(row.Id) : null;
}

async function createIncomeAccount({
  accessToken,
  realmId,
  name = "Sales of Product Income",
}) {
  const url = `${QBO(realmId)}/account?minorversion=${MINOR}`;
  const payload = {
    Name: name,
    AccountType: "Income",
    AccountSubType: "SalesOfProductIncome",
  };
  const r = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  const id = r.data?.Account?.Id;
  return id ? String(id) : null;
}

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
  // 1) try preferred names (exact)
  for (const nm of preferredNames) {
    const id = await findAccountId({ accessToken, realmId, name: nm });
    if (id) return id;
  }
  // 2) case-insensitive scan within Income accounts
  for (const nm of preferredNames) {
    const id = await findIncomeAccountIdByScan({
      accessToken,
      realmId,
      name: nm,
    });
    if (id) return id;
  }
  // 3) any Income account
  const anyId = await findAnyIncomeAccountId({ accessToken, realmId });
  if (anyId) return anyId;
  // 4) create a standard one
  const created = await createIncomeAccount({
    accessToken,
    realmId,
    name: "Sales of Product Income",
  });
  if (created) return created;
  throw new Error("No Income account available and creation failed.");
}

async function ensureServiceItem({
  accessToken,
  realmId,
  name,
  incomeAccountId,
  taxable = false,
}) {
  const findSql = `select Id, Name from Item where Name = ${qboQuote(name)}`;
  const f = await qboQuery({ accessToken, realmId, query: findSql });
  const found = (f.data?.QueryResponse?.Item || [])[0];
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
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  return c.data?.Item?.Id ? String(c.data.Item.Id) : null;
}

// ---- address mapper ----
function mapShipAddr(order) {
  const a = order?.address || {};
  const ShipAddr = {
    Line1: a.addressLineOne || a.companyaddress || undefined,
    Line2: a.addressLineTwo || undefined,
    City: a.town || a.city || undefined,
    CountrySubDivisionCode: a.state || undefined,
    PostalCode: a.zipCode || undefined,
    Country: a.country || undefined,
  };
  Object.keys(ShipAddr).forEach(
    (k) => ShipAddr[k] === undefined && delete ShipAddr[k]
  );
  return Object.keys(ShipAddr).length ? ShipAddr : undefined;
}

// ---- PaymentMethod (optional; for Payment) ----
async function ensurePaymentMethod({ accessToken, realmId, name, type }) {
  if (!name) return null;
  const safe = String(name).trim();
  if (!safe) return null;

  let pmType = type; // "CreditCard" | "NonCreditCard"
  if (!pmType) {
    const s = safe.toLowerCase();
    pmType = s.includes("card") ? "CreditCard" : "NonCreditCard";
  }

  const findSql = `select Id, Name from PaymentMethod where Name = ${qboQuote(name)}`;
  const r = await qboQuery({ accessToken, realmId, query: findSql });
  const found = (r.data?.QueryResponse?.PaymentMethod || [])[0];
  if (found?.Id) return String(found.Id);

  const url = `${QBO(realmId)}/paymentmethod?minorversion=${MINOR}`;
  const payload = { Name: safe, Type: pmType };
  const c = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  return c.data?.PaymentMethod?.Id ? String(c.data.PaymentMethod.Id) : null;
}

function mapPaymentMethodName(raw) {
  const s = String(raw || "").toLowerCase();
  if (s.includes("check") || s.includes("cheque") || s.includes("bank check"))
    return "Check";
  if (s.includes("cash")) return "Cash";
  if (s.includes("card")) return "Credit Card";
  if (s.includes("bank") || s.includes("ach") || s.includes("transfer"))
    return "Bank Transfer";
  return null;
}

// check if any Payment already linked to this invoice
async function findPaymentForInvoice({ accessToken, realmId, invoiceId }) {
  const sql = `select Id, TotalAmt from Payment where Any(LinkedTxn.TxnId) = '${String(
    invoiceId
  )}' and Any(LinkedTxn.TxnType) = 'Invoice'`;
  const r = await qboQuery({ accessToken, realmId, query: sql });
  const row = r.data?.QueryResponse?.Payment?.[0];
  return row?.Id || null;
}

// --- TERMS: map & ensure ---
function mapOrderTerm(order) {
  const d = Number(order.termDays || 0);
  if (d >= 60) return { name: "Net 60", dueDays: 60 };
  if (d >= 30) return { name: "Net 30", dueDays: 30 };
  if (d >= 15) return { name: "Net 15", dueDays: 15 };
  return { name: "Due on receipt", dueDays: 0 };
}

async function ensureTermRef({ accessToken, realmId, name, dueDays }) {
  const q = `select Id, Name from Term where Name = ${qboQuote(name)}`;
  const r = await qboQuery({ accessToken, realmId, query: q });
  const row = r.data?.QueryResponse?.Term?.[0];
  if (row?.Id) return { value: String(row.Id), name };

  // create if not found (may fail on some SKUs — that’s ok)
  try {
    const c = await axios.post(
      `${QBO(realmId)}/term?minorversion=${MINOR}`,
      { Name: name, DueDays: dueDays, Type: "STANDARD" },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    const id = c.data?.Term?.Id;
    return id ? { value: String(id), name } : null;
  } catch {
    return null;
  }
}

// --- SHIP METHOD: id-only helper (name-only fallback happens in payload build) ---
// --- SHIP METHOD: robust resolver (safe on realms w/out ShipMethod) ---
async function getShipMethodId({ accessToken, realmId, name }) {
  const safe = String(name || "").trim();
  if (!safe) return null;

  const qUrl = `${QBO(realmId)}/query?minorversion=${MINOR}`;
  const hTxt = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/text",
  };

  // 1) Try to find by exact name. If realm doesn't support ShipMethod (4001),
  // swallow and return null so caller can fallback to CustomField/PrivateNote.
  try {
    const sql = `select Id, Name from ShipMethod where Name = '${safe.replace(/'/g, "\\'")}'`;
    console.log("[QBO][ShipMethod][QL] ->", sql);
    const r = await axios.post(qUrl, sql, {
      headers: hTxt,
      validateStatus: () => true,
    });

    const fault = r.data?.Fault?.Error?.[0];
    if (r.status >= 400) {
      const code = String(fault?.code || "");
      const detail = String(fault?.Detail || fault?.Message || "");
      if (code === "4001" && /ShipMethod/i.test(detail)) {
        console.warn(
          "[QBO][ShipMethod] Metadata not available in this realm (Shipping feature off or SKU/region limitation). Falling back."
        );
        return null; // ← let caller use name-only/custom-field note
      }
      if (r.status === 404) {
        console.warn("[QBO][ShipMethod] Endpoint not available; falling back.");
        return null;
      }
      throw new Error(
        `QBO ShipMethod query failed: status=${r.status} code=${code} detail=${detail}`
      );
    }

    const row = r.data?.QueryResponse?.ShipMethod?.[0];
    if (row?.Id) return String(row.Id);
  } catch (e) {
    // Network or unexpected shape – log and fallback, don't block invoice creation
    console.warn("[QBO][ShipMethod] query threw:", e?.message || e);
    if (e?.stack) console.warn(e.stack);
    return null;
  }

  // 2) Try to create only if entity seems supported (no 4001 earlier).
  try {
    const url = `${QBO(realmId)}/shipmethod?minorversion=${MINOR}`;
    const payload = { Name: safe };
    console.log("[QBO][ShipMethod][POST] ->", url, payload);
    const c = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });

    const f = c.data?.Fault?.Error?.[0];
    if (c.status >= 400) {
      if (String(f?.code || "") === "4001") {
        console.warn(
          "[QBO][ShipMethod] Create unsupported in this realm; fallback."
        );
        return null;
      }
      // If duplicate or minor validation, try to read again by name next time.
      console.warn(
        "[QBO][ShipMethod] create failed:",
        c.status,
        f?.code,
        f?.Detail || f?.Message
      );
      return null;
    }
    return c.data?.ShipMethod?.Id ? String(c.data.ShipMethod.Id) : null;
  } catch (e) {
    console.warn("[QBO][ShipMethod] create threw:", e?.message || e);
    if (e?.stack) console.warn(e.stack);
    return null;
  }
}

// ----------------------------------------------------------------
// MAIN (unchanged business logic – shipping line, ShipMethodRef, terms, etc.)
async function createInvoiceFromOrder({
  accessToken,
  realmId,
  order,
  billEmail,
  incomeAccountName = "Sales of Product Income",
  genericItemName = "Coffee Sale",
  shippingItemName = "Shipping",
  shippingTaxable = false,
}) {
  const rid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const tag = `[QBO][inv:${rid}]`;
  const started = Date.now();

  try {
    if (!accessToken || !realmId)
      throw new Error("Missing accessToken/realmId");
    if (!order) throw new Error("Missing order");

    const customerId =
      order.qboCustomerId ||
      order.qboCustomerid ||
      order.customerId ||
      order.qbCustomerId ||
      order.quickbooksCustomerId;
    if (!customerId) throw new Error("qboCustomerId not found in order");

    const incomeAccountId = await ensureIncomeAccount({
      accessToken,
      realmId,
      preferredNames: [incomeAccountName, "Sales of Product Income", "Sales"],
    });

    const genericItemId = await ensureServiceItem({
      accessToken,
      realmId,
      name: genericItemName,
      incomeAccountId,
      taxable: false,
    });

    const Lines = [];
    const list = Array.isArray(order.items) ? order.items : [];
    for (const it of list) {
      const qty = +Number(it.qty || 1).toFixed(4);
      const lineTotal = +Number(it.price || it.total || 0).toFixed(2);
      const rate = qty > 0 ? +Number(lineTotal / qty).toFixed(4) : 0;

      const desc = [
        it.product || it.productName || "Coffee Product",
        it.grind && `(${String(it.grind).trim()})`,
        it.productCode && `Code: ${it.productCode}`,
        it.singleUnitWeight && `Unit: ${it.singleUnitWeight}`,
      ]
        .filter(Boolean)
        .join(" • ");

      Lines.push({
        Amount: +Number(qty * rate).toFixed(2),
        Description: desc,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: String(genericItemId) },
          Qty: qty,
          UnitPrice: rate,
          TaxCodeRef: { value: "NON" },
        },
      });
    }

    // Shipping as LINE ITEM (QBO-supported)
    const shippingAmt = +Number(order.shippingCharges || 0).toFixed(2);
    if (shippingAmt > 0) {
      const shippingItemId = await ensureServiceItem({
        accessToken,
        realmId,
        name: shippingItemName,
        incomeAccountId,
        taxable: !!shippingTaxable,
      });

      const hasShipLine = Lines.some(
        (l) =>
          l.DetailType === "SalesItemLineDetail" &&
          (l.SalesItemLineDetail?.ItemRef?.value === String(shippingItemId) ||
            String(l.Description || "").toLowerCase() === "shipping")
      );

      if (!hasShipLine) {
        Lines.push({
          Amount: shippingAmt,
          Description: `Shipping Charges (${order.shippingCompany || "Shipping"})`,
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            ItemRef: { value: String(shippingItemId) },
            Qty: 1,
            UnitPrice: shippingAmt,
            TaxCodeRef: { value: shippingTaxable ? "TAX" : "NON" },
          },
        });
      }
    }

    if (Lines.length === 0) {
      const total = +Number(order.totalBill || 0).toFixed(2);
      Lines.push({
        Amount: total,
        Description: genericItemName,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: String(genericItemId) },
          Qty: 1,
          UnitPrice: total,
          TaxCodeRef: { value: "NON" },
        },
      });
    }

    const txnDate = (
      order.invoiceDate ? new Date(order.invoiceDate) : new Date()
    )
      .toISOString()
      .slice(0, 10);
    const base = new Date(txnDate);
    const due = new Date(base);
    const termDays = Number(order.termDays || 0);
    if (termDays > 0) due.setDate(due.getDate() + termDays);
    const dueDate = due.toISOString().slice(0, 10);

    const ShipAddr = mapShipAddr(order);

    // Ship Via (id → name-only fallback)
    let ShipMethodRef;
    if (order.shippingCompany) {
      const shipId = await getShipMethodId({
        accessToken,
        realmId,
        name: order.shippingCompany,
      });
      ShipMethodRef = shipId
        ? { value: shipId, name: String(order.shippingCompany) }
        : { name: String(order.shippingCompany) };
    }

    // Terms
    let SalesTermRef = null;
    try {
      const t = mapOrderTerm(order);
      const termRef = await ensureTermRef({
        accessToken,
        realmId,
        name: t.name,
        dueDays: t.dueDays,
      });
      if (termRef?.value) SalesTermRef = termRef;
    } catch {}

    // Ship date & Tracking
    const ShipDate = order.shippingDate
      ? new Date(order.shippingDate).toISOString().slice(0, 10)
      : undefined;
    const TrackingNum =
      order.trackingId || order.trackingNo || order.trackingNumber || undefined;

    const payload = {
      CustomerRef: { value: String(customerId) },
      Line: Lines,
      CurrencyRef: { value: "USD" },
      DocNumber: order.invoiceNumber || undefined,
      TxnDate: txnDate,
      ...(SalesTermRef ? {} : { DueDate: dueDate }),
      PrivateNote: order.note || undefined,
      BillEmail: billEmail ? { Address: billEmail } : undefined,
      ShipAddr,
      PONumber: order.poNumber || undefined,
      ...(ShipMethodRef ? { ShipMethodRef } : {}),
      ...(SalesTermRef ? { SalesTermRef } : {}),
      ...(ShipDate ? { ShipDate } : {}),
      ...(TrackingNum ? { TrackingNum } : {}),
    };
    Object.keys(payload).forEach(
      (k) => payload[k] === undefined && delete payload[k]
    );

    const url = `${QBO(realmId)}/invoice?minorversion=${MINOR}`;
    console.log(`${tag} POST ${url}`, {
      hasShipVia: !!ShipMethodRef,
      hasTerms: !!SalesTermRef,
      lines: Lines.length,
      docNumber: order?.invoiceNumber || null,
    });

    let invRes;
    try {
      invRes = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
    } catch (e) {
      const err0 = e?.response?.data?.Fault?.Error?.[0] || {};
      const code = String(err0.code || "");
      const detail = String(err0.Detail || err0.Message || "");
      const looksLikeShipRefIssue =
        code === "2010" && /ShipMethodRef|unsupported|invalid/i.test(detail);
      if (looksLikeShipRefIssue && payload.ShipMethodRef) {
        const { ShipMethodRef: _drop, ...retryPayload } = payload;
        console.warn(
          `${tag} ShipMethodRef rejected (${code}); retrying without it…`
        );
        invRes = await axios.post(url, retryPayload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });
      } else {
        throw e;
      }
    }

    const inv = invRes.data?.Invoice || invRes.data;
    console.log(`${tag} ✓ invoice created`, {
      id: inv?.Id || null,
      doc: inv?.DocNumber || null,
      total: inv?.TotalAmt || null,
      balance: inv?.Balance ?? null,
      shipMethod: inv?.ShipMethodRef?.name || inv?.ShipMethodRef?.value || null,
      termId: inv?.SalesTermRef?.value || null,
      due: inv?.DueDate || null,
      shipDate: inv?.ShipDate || null,
      tracking: inv?.TrackingNum || null,
    });

    console.log(`${tag} done in ${Date.now() - started}ms`);
    return {
      id: inv?.Id ?? null,
      docNumber: inv?.DocNumber ?? null,
      totalAmt: inv?.TotalAmt ?? null,
      dueDate: inv?.DueDate ?? null,
      shipMethodId: inv?.ShipMethodRef?.value || null,
      salesTermId: inv?.SalesTermRef?.value || null,
      shippingLineFound: Array.isArray(inv?.Line)
        ? inv.Line.some(
            (l) =>
              l.DetailType === "SalesItemLineDetail" &&
              (l.SalesItemLineDetail?.ItemRef?.name === shippingItemName ||
                (order.shippingCompany &&
                  String(l.Description || "").includes(order.shippingCompany)))
          )
        : null,
      raw: inv,
    };
  } catch (err) {
    console.error(`${tag} ✗ ERROR:`, err?.message || err);
    if (err?.stack) console.error(`${tag} STACK:\n${err.stack}`);
    if (err?.response) {
      const { status, headers, data } = err.response;
      console.error(`${tag} axios.status=`, status);
      if (headers) console.error(`${tag} axios.headers=`, headers);
      if (data)
        console.error(
          `${tag} axios.data=`,
          typeof data === "string" ? data : JSON.stringify(data, null, 2)
        );
    }
    console.error(`${tag} failed in ${Date.now() - started}ms`);
    throw err;
  }
}

// ---- Payment (unchanged except robust logging) ----
async function createPaymentForInvoice({
  accessToken,
  realmId,
  invoiceId,
  customerId,
  amount,
  paymentMethodName,
  refNumber,
  paidDate,
}) {
  const rid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const tag = `[QBO][pay:${rid}]`;
  const started = Date.now();

  try {
    if (!accessToken || !realmId)
      throw new Error("Missing accessToken/realmId");
    if (!invoiceId || !customerId || amount == null)
      throw new Error("Missing invoiceId/customerId/amount");

    console.log(`${tag} start`, {
      realmId,
      invoiceId: String(invoiceId),
      customerId: String(customerId),
      amount: Number(amount),
      paymentMethodName: paymentMethodName || null,
      refNumber: refNumber || null,
      paidDate: paidDate || null,
    });

    let existing = null;
    try {
      const existingId = await findPaymentForInvoice({
        accessToken,
        realmId,
        invoiceId,
      });
      existing = existingId;
      console.log(`${tag} precheck existing payment=`, existing || null);
    } catch (preErr) {
      console.warn(`${tag} precheck failed:`, preErr?.message || preErr);
    }
    if (existing) {
      console.log(
        `${tag} ✓ already paid (paymentId=${existing}) in ${Date.now() - started}ms`
      );
      return { id: existing, alreadyExisted: true };
    }

    let PaymentMethodRef;
    if (paymentMethodName) {
      try {
        const pmId = await ensurePaymentMethod({
          accessToken,
          realmId,
          name: paymentMethodName,
        });
        if (pmId)
          PaymentMethodRef = { value: String(pmId), name: paymentMethodName };
        console.log(`${tag} payment method`, {
          name: paymentMethodName,
          id: pmId || null,
        });
      } catch (pmErr) {
        console.warn(
          `${tag} payment method ensure failed:`,
          pmErr?.message || pmErr
        );
      }
    }

    const TxnDate = paidDate || new Date().toISOString().slice(0, 10);
    const amt = +Number(amount).toFixed(2);
    const payload = {
      CustomerRef: { value: String(customerId) },
      TotalAmt: amt,
      TxnDate,
      PaymentRefNum: refNumber || undefined,
      ...(PaymentMethodRef ? { PaymentMethodRef } : {}),
      Line: [
        {
          Amount: amt,
          LinkedTxn: [{ TxnId: String(invoiceId), TxnType: "Invoice" }],
        },
      ],
    };
    Object.keys(payload).forEach(
      (k) => payload[k] === undefined && delete payload[k]
    );

    const url = `${QBO(realmId)}/payment?minorversion=${MINOR}`;
    console.log(`${tag} POST ${url}`, {
      amount: payload.TotalAmt,
      date: payload.TxnDate,
      hasPaymentMethod: !!PaymentMethodRef,
    });

    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const pay = res.data?.Payment || res.data;
    console.log(`${tag} ✓ payment created`, {
      id: pay?.Id || null,
      total: pay?.TotalAmt || null,
      date: pay?.TxnDate || null,
    });

    console.log(`${tag} done in ${Date.now() - started}ms`);
    return { id: pay?.Id, alreadyExisted: false, raw: pay };
  } catch (err) {
    console.error(`${tag} ✗ ERROR:`, err?.message || err);
    if (err?.stack) console.error(`${tag} STACK:\n${err.stack}`);
    if (err?.response) {
      const { status, headers, data } = err.response;
      console.error(`${tag} axios.status=`, status);
      if (headers) console.error(`${tag} axios.headers=`, headers);
      if (data)
        console.error(
          `${tag} axios.data=`,
          typeof data === "string" ? data : JSON.stringify(data, null, 2)
        );
    }
    console.error(`${tag} failed in ${Date.now() - started}ms`);
    throw err;
  }
}

module.exports = {
  createInvoiceFromOrder,
  createPaymentForInvoice,
  mapPaymentMethodName,
};
