// services/qboInvoice.min.js
const axios = require("axios");
const { or } = require("sequelize");

// ---- Base (set QBO_ENV=sandbox for sandbox; else production) ----
const BASE =
  (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const QBO = (realmId) => `${BASE}/v3/company/${realmId}`;
const MINOR = 70;

// ---- tiny HTTP helpers (no refresh/probe) ----
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
async function qboQuery({ accessToken, realmId, query }) {
  const url = `${QBO(realmId)}/query?minorversion=${MINOR}`;
  return qboPost({
    accessToken,
    url,
    data: query,
    contentType: "application/text",
  });
}

// ---- lookups / ensure ----
async function findAccountId({ accessToken, realmId, name }) {
  const safe = String(name || "").replace(/'/g, "\\'");
  const sql = `select Id, Name from Account where Name = '${safe}'`;
  const r = await qboQuery({ accessToken, realmId, query: sql });
  const rows = r.data?.QueryResponse?.Account || [];
  return rows[0]?.Id || null;
}
async function ensureServiceItem({
  accessToken,
  realmId,
  name,
  incomeAccountId,
  taxable = false,
}) {
  const safe = String(name || "").replace(/'/g, "\\'");
  const findSql = `select Id, Name from Item where Name = '${safe}'`;
  const f = await qboQuery({ accessToken, realmId, query: findSql });
  const found = (f.data?.QueryResponse?.Item || [])[0];
  if (found?.Id) return found.Id;

  const createUrl = `${QBO(realmId)}/item?minorversion=${MINOR}`;
  const payload = {
    Name: name,
    Type: "Service",
    IncomeAccountRef: { value: String(incomeAccountId) },
    TrackQtyOnHand: false,
    Taxable: Boolean(taxable),
  };
  const c = await qboPost({ accessToken, url: createUrl, data: payload });
  return c.data?.Item?.Id;
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
// Ensure a ShipMethod exists by name; create if missing → return Id

// 1) ID-only resolver (no name-only fallback)

// small helper to append notes safely
function appendNote(existing, extra) {
  return [existing, extra].filter(Boolean).join(" | ");
}

// Ensure a PaymentMethod exists by name; create if missing → return Id
async function ensurePaymentMethod({ accessToken, realmId, name, type }) {
  if (!name) return null;
  const safe = String(name).trim();
  if (!safe) return null;

  // best-effort type inference if not provided
  let pmType = type; // "CreditCard" | "NonCreditCard"
  if (!pmType) {
    const s = safe.toLowerCase();
    pmType = s.includes("card") ? "CreditCard" : "NonCreditCard";
  }

  // 1) find by exact Name
  const findSql = `select Id, Name from PaymentMethod where Name = '${safe.replace(/'/g, "\\'")}'`;
  const r = await qboQuery({ accessToken, realmId, query: findSql });
  const found = (r.data?.QueryResponse?.PaymentMethod || [])[0];
  if (found?.Id) return String(found.Id);

  // 2) create
  const url = `${QBO(realmId)}/paymentmethod?minorversion=${MINOR}`;
  const payload = { Name: safe, Type: pmType }; // Type optional but good to set
  const c = await qboPost({ accessToken, url, data: payload });
  return c.data?.PaymentMethod?.Id ? String(c.data.PaymentMethod.Id) : null;
}

// map "bank check" etc to QBO PaymentMethod
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
  const sql = `select Id, TotalAmt from Payment where Any(LinkedTxn.TxnId) = '${String(invoiceId)}'`;
  const url = `${QBO(realmId)}/query?minorversion=${MINOR}`;
  const r = await axios.post(url, sql, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/text",
    },
  });
  const row = r.data?.QueryResponse?.Payment?.[0];
  return row?.Id || null;
}

// Agar qboGet nahi hai to add this tiny helper:
async function qboGet({ accessToken, realmId, path }) {
  const url = `${QBO(realmId)}${path}`;
  return axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
}

// --- TERMS: map & ensure ---
function mapOrderTerm(order) {
  // priority: explicit name -> days
  const d = Number(order.termDays || 0);
  if (d >= 60) return { name: "Net 60", dueDays: 60 };
  if (d >= 30) return { name: "Net 30", dueDays: 30 };
  if (d >= 15) return { name: "Net 15", dueDays: 15 };
  return { name: "Due on receipt", dueDays: 0 };
}

async function ensureTermRef({ accessToken, realmId, name, dueDays }) {
  const q = `select Id, Name from Term where Name = '${String(name).replace(/'/g, "\\'")}'`;
  const qUrl = `${QBO(realmId)}/query?minorversion=${MINOR}`;
  const hTxt = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/text",
  };
  const hJson = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  try {
    const r = await axios.post(qUrl, q, { headers: hTxt });
    const row = r.data?.QueryResponse?.Term?.[0];
    if (row?.Id) return { value: String(row.Id), name };
  } catch (_) {
    /* ignore */
  }

  // create if not found
  try {
    const c = await axios.post(
      `${QBO(realmId)}/term?minorversion=${MINOR}`,
      {
        Name: name,
        DueDays: dueDays, // STANDARD terms
        Type: "STANDARD",
      },
      { headers: hJson }
    );
    const id = c.data?.Term?.Id;
    return id ? { value: String(id), name } : null;
  } catch (_) {
    return null; // if creation blocked by company permissions
  }
}

// --- SHIP METHOD: id-only (avoid [object Object]) ---
// --- ID-only resolver (no name-only ref to avoid [object Object]) ---
async function getShipMethodId({ accessToken, realmId, name }) {
  const safe = String(name || "").trim();
  if (!safe) return null;

  const qUrl = `${QBO(realmId)}/query?minorversion=${MINOR}`;
  const hTxt = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/text",
  };

  try {
    const sql = `select Id, Name from ShipMethod where Name = '${safe.replace(/'/g, "\\'")}'`;
    const r = await axios.post(qUrl, sql, { headers: hTxt });
    const row = r.data?.QueryResponse?.ShipMethod?.[0];
    if (row?.Id) return String(row.Id);
  } catch (e) {
    const code = e?.response?.data?.Fault?.Error?.[0]?.code;
    if (String(code) === "4001") return null; // entity unsupported in this realm
  }

  try {
    const c = await axios.post(
      `${QBO(realmId)}/shipmethod?minorversion=${MINOR}`,
      { Name: safe },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    return c.data?.ShipMethod?.Id ? String(c.data.ShipMethod.Id) : null;
  } catch {
    return null;
  }
}

function appendNote(existing, extra) {
  return [existing, extra].filter(Boolean).join(" | ");
}

// Helper: safe append to PrivateNote
function appendNote(existing, extra) {
  return [existing, extra].filter(Boolean).join(" | ");
}

// Assumes you already have helpers in same module/file:
// - QBO(realmId), MINOR
// - findAccountId({ accessToken, realmId, name })
// - ensureServiceItem({ accessToken, realmId, name, incomeAccountId, taxable })
// - ensureShipMethod({ accessToken, realmId, name })
// - mapShipAddr(order)

async function createInvoiceFromOrder({
  accessToken,
  realmId,
  order,
  billEmail,
  incomeAccountName = "Sales of Product Income",
  genericItemName = "Coffee Sale",
  shippingItemName = "Shipping",
  shippingTaxable = false, // true if shipping should be taxed
}) {
  const rid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const tag = `[QBO][inv:${rid}]`;
  const started = Date.now();

  try {
    if (!accessToken || !realmId)
      throw new Error("Missing accessToken/realmId");
    if (!order) throw new Error("Missing order");

    // ---------- Customer ----------
    const customerId =
      order.qboCustomerId ||
      order.qboCustomerid ||
      order.customerId ||
      order.qbCustomerId ||
      order.quickbooksCustomerId;
    if (!customerId) throw new Error("qboCustomerId not found in order");

    // ---------- Income account & generic item ----------
    let incomeAccountId =
      (await findAccountId({
        accessToken,
        realmId,
        name: incomeAccountName,
      })) || (await findAccountId({ accessToken, realmId, name: "Sales" }));
    if (!incomeAccountId) {
      throw new Error(
        "Income account not found (try 'Sales of Product Income' or 'Sales')."
      );
    }

    const genericItemId = await ensureServiceItem({
      accessToken,
      realmId,
      name: genericItemName,
      incomeAccountId,
      taxable: false,
    });

    // ---------- Lines (products) ----------
    const Lines = [];
    const list = Array.isArray(order.items) ? order.items : [];
    for (const it of list) {
      const qty = +Number(it.qty || 1).toFixed(4);
      // NOTE: treating 'price' as LINE TOTAL. If it's unit price, adjust.
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
          TaxCodeRef: { value: "NON" }, // change if items are taxable
        },
      });
    }

    // ---------- Shipping as LINE ITEM ----------
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

    // ---------- Dates & ShipAddr ----------
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

    // ---------- Ship Via (UPDATED LOGIC) ----------
    // try to resolve an id; if not found, send name-only (free-text realms)
    let ShipMethodRef;
    if (order.shippingCompany) {
      const shipId = await getShipMethodId({
        accessToken,
        realmId,
        name: order.shippingCompany,
      });
      ShipMethodRef = shipId
        ? { value: shipId, name: String(order.shippingCompany) }
        : { name: String(order.shippingCompany) }; // <= name-only
    }

    // ---------- Terms (SalesTermRef) ----------
    let SalesTermRef = null;
    try {
      const t = mapOrderTerm(order); // e.g., { name: "Net 30", dueDays: 30 }
      const termRef = await ensureTermRef({
        accessToken,
        realmId,
        name: t.name,
        dueDays: t.dueDays,
      });
      if (termRef?.value) SalesTermRef = termRef;
    } catch (_) {
      // ignore; invoice will still post
    }

    // ---------- Ship date & Tracking no. ----------
    const ShipDate = order.shippingDate
      ? new Date(order.shippingDate).toISOString().slice(0, 10)
      : undefined;
    const TrackingNum =
      order.trackingId || order.trackingNo || order.trackingNumber || undefined;

    // ---------- Payload ----------
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

    // ---------- POST /invoice (retry without ShipMethodRef if rejected) ----------
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

async function createPaymentForInvoice({
  accessToken,
  realmId,
  invoiceId,
  customerId,
  amount, // e.g. inv.totalAmt
  paymentMethodName, // optional: "Check", "Bank Transfer", ...
  refNumber, // optional: your INV #
  paidDate, // optional: 'YYYY-MM-DD'
}) {
  const rid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const tag = `[QBO][pay:${rid}]`;
  const started = Date.now();

  try {
    // Basic validation
    if (!accessToken || !realmId)
      throw new Error("Missing accessToken/realmId");
    if (!invoiceId || !customerId || amount == null) {
      throw new Error("Missing invoiceId/customerId/amount");
    }

    console.log(`${tag} start`, {
      realmId,
      invoiceId: String(invoiceId),
      customerId: String(customerId),
      amount: Number(amount),
      paymentMethodName: paymentMethodName || null,
      refNumber: refNumber || null,
      paidDate: paidDate || null,
    });

    // Idempotency: skip if a payment already links to this invoice
    let existing = null;
    try {
      existing = await findPaymentForInvoice({
        accessToken,
        realmId,
        invoiceId,
      });
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

    // Optional PaymentMethodRef
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

    // Build payload
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
      // DepositToAccountRef: { value: "<ACCOUNT_ID>" }, // optional
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
    // Full error + stack
    console.error(`${tag} ✗ ERROR:`, err?.message || err);
    if (err?.stack) console.error(`${tag} STACK:\n${err.stack}`);

    // Axios response details (if present)
    if (err?.response) {
      const { status, headers, data } = err.response;
      console.error(`${tag} axios.status=`, status);
      if (headers) console.error(`${tag} axios.headers=`, headers);
      if (data) {
        console.error(
          `${tag} axios.data=`,
          typeof data === "string" ? data : JSON.stringify(data, null, 2)
        );
      }
    }

    console.error(`${tag} failed in ${Date.now() - started}ms`);
    throw err; // rethrow for caller to handle
  }
}
module.exports = {
  createInvoiceFromOrder,
  createPaymentForInvoice,
  mapPaymentMethodName,
};
