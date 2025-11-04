// services/qboInvoice.js
const axios = require("axios");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { getOrderWithAssociations } = require("./orderService");
const { ensureItemByName, warmupQBOResources } = require("./qboItemService");

const BASE =
  (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const QBO = (realmId) => `${BASE}/v3/company/${realmId}`;
const MINOR = 70;

// ---- Generic helpers ----
const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/json",
  "Content-Type": "application/json",
});

// ---- Invoice creation ----

async function createInvoiceFromOrder(orderId) {
  if (!orderId) throw new Error("Missing orderId");

  // ✅ 1. Refresh token and get QBO credentials
  const { accessToken, realmId } = await refreshAccessTokenIfNeeded();
  if (!accessToken || !realmId) throw new Error("Missing QBO credentials");

  // ✅ 2. Fetch the order details (with items, user, address, etc.)
  const order = await getOrderWithAssociations(orderId);
  if (!order) throw new Error(`Order not found with id=${orderId}`);
  if (order?.quickBooksInvoiceId)
    throw new Error(
      "Duplicate invoice detected — this invoice is already recorded in QuickBooks."
    );
  // ✅ 3. Warm up QBO base resources (Income account + generic item)
  const { genericItemId } = await warmupQBOResources({ accessToken, realmId });

  // ✅ 4. Build line items using generic item
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
      Amount: +(qty * rate).toFixed(2),
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

  // ✅ 5. Build invoice payload
  const payload = {
    CustomerRef: { value: String(order.qboCustomerId) },
    Line: Lines,
    TxnDate: new Date(order.invoiceDate || Date.now())
      .toISOString()
      .slice(0, 10),
    BillEmail: order.user?.email ? { Address: order.user.email } : undefined,
    DocNumber: order.invoiceNumber || undefined,
    PrivateNote: order.note || undefined,
    ShipAddr: order.address
      ? {
          Line1: order.address.addressLineOne,
          Line2: order.address.addressLineTwo,
          City: order.address.city,
          CountrySubDivisionCode: order.address.state,
          PostalCode: order.address.zipCode,
          Country: order.address.country,
        }
      : undefined,
    ShipMethodRef: order.shippingCompany
      ? { name: order.shippingCompany }
      : undefined,
    DueDate: order.termDays
      ? new Date(Date.now() + order.termDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
      : undefined,
  };

  // ✅ 6. Send to QuickBooks
  const url = `${QBO(realmId)}/invoice?minorversion=${MINOR}`;
  const res = await axios.post(url, payload, { headers: headers(accessToken) });

  // ✅ 7. Return formatted result
  const inv = res.data?.Invoice;
  return {
    id: inv?.Id,
    docNumber: inv?.DocNumber,
    totalAmt: inv?.TotalAmt,
    raw: inv,
  };
}

// ---- Payment creation ----
async function createPaymentForInvoice({
  accessToken,
  realmId,
  invoiceId,
  customerId,
  amount,
  paymentMethodName = "Credit Card",
  refNumber,
  paidDate,
}) {
  if (!accessToken || !realmId) throw new Error("Missing QBO credentials");
  if (!invoiceId || !customerId)
    throw new Error("Missing invoice or customer ID");

  const payload = {
    CustomerRef: { value: String(customerId) },
    TotalAmt: Number(amount),
    TxnDate: paidDate || new Date().toISOString().slice(0, 10),
    PaymentRefNum: refNumber || `ref-${invoiceId}`,
    PaymentMethodRef: { name: paymentMethodName },
    Line: [
      {
        Amount: Number(amount),
        LinkedTxn: [{ TxnId: String(invoiceId), TxnType: "Invoice" }],
      },
    ],
  };

  const url = `${QBO(realmId)}/payment?minorversion=${MINOR}`;
  const res = await axios.post(url, payload, { headers: headers(accessToken) });
  return res.data?.Payment || res.data;
}

// ---- Utility: Map payment method ----
function mapPaymentMethodName(raw) {
  const s = String(raw || "").toLowerCase();
  if (s.includes("card")) return "Credit Card";
  if (s.includes("bank")) return "Bank Transfer";
  if (s.includes("cash")) return "Cash";
  if (s.includes("check")) return "Check";
  return "Other";
}

module.exports = {
  createInvoiceFromOrder,
  createPaymentForInvoice,
  mapPaymentMethodName,
};
