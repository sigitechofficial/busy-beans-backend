// services/qboInvoice.min.js
const axios = require("axios");

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

async function ensureShipMethod({ accessToken, realmId, name }) {
  if (!name) return null;
  const safe = String(name).replace(/'/g, "\\'");
  const findSql = `select Id, Name from ShipMethod where Name = '${safe}'`;
  const f = await qboQuery({ accessToken, realmId, query: findSql });
  const found = (f.data?.QueryResponse?.ShipMethod || [])[0];
  if (found?.Id) return found.Id;

  const url = `${QBO(realmId)}/shipmethod?minorversion=${MINOR}`;
  const payload = { Name: name };
  const c = await qboPost({ accessToken, url, data: payload });
  return c.data?.ShipMethod?.Id || null;
}

// ---- PaymentMethod (optional; for Payment) ----
// Ensure a ShipMethod exists by name; create if missing → return Id
async function ensureShipMethod({ accessToken, realmId, name }) {
  if (!name) return null;
  const safe = String(name).trim();
  if (!safe) return null;

  // 1) find by exact Name
  const findSql = `select Id, Name from ShipMethod where Name = '${safe.replace(/'/g, "\\'")}'`;
  const f = await qboQuery({ accessToken, realmId, query: findSql });
  const found = (f.data?.QueryResponse?.ShipMethod || [])[0];
  if (found?.Id) return String(found.Id);

  // 2) create
  const url = `${QBO(realmId)}/shipmethod?minorversion=${MINOR}`;
  const payload = { Name: safe };
  const c = await qboPost({ accessToken, url, data: payload });
  return c.data?.ShipMethod?.Id ? String(c.data.ShipMethod.Id) : null;
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

// === UPDATED createInvoiceFromOrder ===
async function createInvoiceFromOrder({
  accessToken,
  realmId,
  order,
  billEmail, // optional
  incomeAccountName = "Sales of Product Income",
  genericItemName = "Coffee Sale",
  shippingItemName = "Shipping",
  shippingTaxable = false, // set true if shipping taxable in your QBO
  createPaymentOnPaid = true, // auto-create Payment if order is paid
}) {
  if (!accessToken || !realmId) throw new Error("Missing accessToken/realmId");
  if (!order) throw new Error("Missing order");

  // ---- CustomerRef ----
  const customerId =
    order.qboCustomerId ||
    order.qboCustomerid ||
    order.customerId ||
    order.qbCustomerId ||
    order.quickbooksCustomerId;
  if (!customerId) throw new Error("qboCustomerId not found in order");

  // ---- Income account & generic item ----
  let incomeAccountId =
    (await findAccountId({ accessToken, realmId, name: incomeAccountName })) ||
    (await findAccountId({ accessToken, realmId, name: "Sales" }));
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

  // ---- Build item lines (no ShippingAmt property; shipping as line) ----
  const Lines = [];
  const list = Array.isArray(order.items) ? order.items : [];
  for (const it of list) {
    const qty = +Number(it.qty || 1).toFixed(4);
    // NOTE: your 'price' = LINE TOTAL; change if it's unit price in your DB
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

  // ---- Shipping as its own line item (supported way) ----
  const shippingAmt = +Number(order.shippingCharges || 0).toFixed(2);
  if (shippingAmt > 0) {
    const shippingItemId = await ensureServiceItem({
      accessToken,
      realmId,
      name: shippingItemName,
      incomeAccountId,
      taxable: !!shippingTaxable,
    });
    Lines.push({
      Amount: shippingAmt,
      Description: order.shippingCompany || "Shipping",
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: String(shippingItemId) },
        Qty: 1,
        UnitPrice: shippingAmt,
        TaxCodeRef: { value: shippingTaxable ? "TAX" : "NON" },
      },
    });
  }

  // ---- Fallback if no lines ----
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

  // ---- Dates & ShipAddr ----
  const today = new Date();
  const txnDate = today.toISOString().slice(0, 10);
  const due = new Date(today);
  const termDays = Number(order.termDays || 0);
  if (termDays > 0) due.setDate(due.getDate() + termDays);
  const dueDate = due.toISOString().slice(0, 10);
  const ShipAddr = mapShipAddr(order);

  // ---- Ship Via (ShipMethodRef) ----
  let ShipMethodRef;
  if (order.shippingCompany) {
    const shipMethodId = await ensureShipMethod({
      accessToken,
      realmId,
      name: order.shippingCompany, // e.g. "UPS"
    });
    if (shipMethodId) ShipMethodRef = { value: String(shipMethodId) };
  }

  // ---- Build invoice payload (NO ShippingAmt) ----
  const payload = {
    CustomerRef: { value: String(customerId) },
    Line: Lines,
    CurrencyRef: { value: "USD" },
    DocNumber: order.invoiceNumber || undefined,
    TxnDate: txnDate,
    DueDate: dueDate,
    PrivateNote: order.note || undefined,
    BillEmail: billEmail ? { Address: billEmail } : undefined,
    ShipAddr,
    PONumber: order.poNumber || undefined,
    ...(ShipMethodRef ? { ShipMethodRef } : {}),
    // Optional tax controls if you use manual tax:
    // GlobalTaxCalculation: "TaxExcluded", // or "TaxInclusive"
    // TxnTaxDetail: { TxnTaxCodeRef: { value: "<TaxCodeId>" } },
  };
  Object.keys(payload).forEach(
    (k) => payload[k] === undefined && delete payload[k]
  );

  // ---- Create the invoice ----
  const invRes = await qboPost({
    accessToken,
    url: `${QBO(realmId)}/invoice?minorversion=${MINOR}`,
    data: payload,
  });
  const created = invRes.data?.Invoice || invRes.data;
  const invoiceId = created?.Id;

  // ---- If paid/done -> create Payment and link to invoice ----
  const paidStatuses = new Set([
    "done",
    "paid",
    "complete",
    "completed",
    "payment done",
    "payment_done",
    "true",
    "1",
    "pending",
  ]);
  let payment = null;

  if (
    createPaymentOnPaid &&
    paidStatuses.has(
      String(order.paymentStatus || "pending")
        .toLowerCase()
        .trim()
    )
  ) {
    const payAmount = +Number(
      created?.TotalAmt || order.totalBill || 0
    ).toFixed(2);

    // Map your paymentMethod to QBO PaymentMethod (ensure/create)
    const rawPm = String(order.paymentMethod || "").toLowerCase();
    const pmName =
      rawPm.includes("check") || rawPm.includes("cheque")
        ? "Check"
        : rawPm.includes("cash")
          ? "Cash"
          : rawPm.includes("card")
            ? "Credit Card"
            : rawPm.includes("bank") ||
                rawPm.includes("ach") ||
                rawPm.includes("transfer")
              ? "Bank Transfer"
              : null;

    let PaymentMethodRef;
    if (pmName) {
      const pmId = await ensurePaymentMethod({
        accessToken,
        realmId,
        name: pmName,
      });
      if (pmId) PaymentMethodRef = { value: String(pmId) };
    }

    const paidDateISO = order.invoicePaidDate
      ? new Date(order.invoicePaidDate).toISOString().slice(0, 10)
      : txnDate;

    const payPayload = {
      CustomerRef: { value: String(customerId) },
      TotalAmt: payAmount,
      TxnDate: paidDateISO,
      PaymentRefNum: order.invoiceNumber || undefined,
      PrivateNote: order.note ? `Auto-paid: ${order.note}` : "Auto-paid",
      ...(PaymentMethodRef ? { PaymentMethodRef } : {}),
      Line: [
        {
          Amount: payAmount,
          LinkedTxn: [{ TxnId: String(invoiceId), TxnType: "Invoice" }],
        },
      ],
      // DepositToAccountRef: { value: "<ACCOUNT_ID>" }, // optional: otherwise Undeposited Funds
    };
    Object.keys(payPayload).forEach(
      (k) => payPayload[k] === undefined && delete payPayload[k]
    );

    const payRes = await qboPost({
      accessToken,
      url: `${QBO(realmId)}/payment?minorversion=${MINOR}`,
      data: payPayload,
    });
    payment = payRes.data?.Payment || payRes.data;
  }

  // ---- Post-verify: fetch invoice to read back ShipMethod/Balance etc. ----
  const readRes = await qboGet({
    accessToken,
    realmId,
    path: `/invoice/${invoiceId}?minorversion=${MINOR}`,
  });
  const inv = readRes.data?.Invoice || readRes.data;

  // ---- Return a flat + helpful shape ----
  return {
    id: inv?.Id ?? null,
    docNumber: inv?.DocNumber ?? null,
    totalAmt: inv?.TotalAmt ?? null,
    balance: inv?.Balance ?? null,
    isPaid: typeof inv?.Balance === "number" ? inv.Balance === 0 : null,
    shipMethodId: inv?.ShipMethodRef?.value || null,
    shipMethodName: inv?.ShipMethodRef?.name || null, // may be null if QBO doesn't echo name
    // Whether shipping came as line item (it will, by design)
    shippingLineFound: Array.isArray(inv?.Line)
      ? inv.Line.some(
          (l) =>
            l.DetailType === "SalesItemLineDetail" &&
            (l.SalesItemLineDetail?.ItemRef?.name === shippingItemName ||
              (order.shippingCompany &&
                String(l.Description || "").includes(order.shippingCompany)))
        )
      : false,
    payment: payment
      ? { id: payment.Id, totalAmt: payment.TotalAmt, txnDate: payment.TxnDate }
      : null,
    raw: { invoice: inv, payment },
  };
}

module.exports = { createInvoiceFromOrder };
