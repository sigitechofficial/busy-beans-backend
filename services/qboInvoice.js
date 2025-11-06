// services/qboInvoice.js
const axios = require("axios");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { getOrderWithAssociations } = require("./orderService");
const { ensureItemByName, warmupQBOResources } = require("./qboItemService");
const { order, partnerOrder } = require("../models");
const Order = order;
const PartnerOrder = partnerOrder;
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

// =========================
// 🔹 Helpers
// =========================

/**
 * Normalize a raw payment method name to a QBO-friendly label
 */
function mapPaymentMethodName(raw) {
  const s = String(raw || "").toLowerCase();
  if (s.includes("card")) return "Credit Card";
  if (s.includes("bank")) return "Bank Transfer";
  if (s.includes("cash")) return "Cash";
  if (s.includes("check")) return "Check";
  return "Other";
}

/**
 * Ensure a PaymentMethod exists in QBO — fetch or create it
 */
async function ensurePaymentMethod({ accessToken, realmId, name }) {
  try {
    // 1️⃣ Try to find existing method
    const query = encodeURIComponent(
      `select * from PaymentMethod where Name='${name}'`
    );
    const res = await axios.get(`${QBO(realmId)}/query?query=${query}`, {
      headers: headers(accessToken),
    });
    const found = res.data?.QueryResponse?.PaymentMethod?.[0];
    if (found?.Id) {
      console.log(`[QBO] Found existing PaymentMethod: ${name} (${found.Id})`);
      return found.Id;
    }

    // 2️⃣ Not found — create new one
    const payload = {
      Name: name,
      Type: name === "Credit Card" ? "CREDIT_CARD" : "OTHER",
      Active: true,
    };
    const createRes = await axios.post(
      `${QBO(realmId)}/paymentmethod`,
      payload,
      {
        headers: headers(accessToken),
      }
    );
    const createdId = createRes.data?.PaymentMethod?.Id;
    console.log(`[QBO] Created new PaymentMethod: ${name} (${createdId})`);
    return createdId;
  } catch (err) {
    console.warn(
      "[QBO] Failed to ensure PaymentMethod:",
      err?.response?.data || err.message
    );
    return null;
  }
}

// =========================
// 🔸 Main Function
// =========================

// ---- Payment creation ----
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
  if (!accessToken || !realmId) throw new Error("Missing QBO credentials");
  if (!invoiceId || !customerId)
    throw new Error("Missing invoice or customer ID");

  const safeAmount = Number(amount) || 0.01;
  const safeDate = new Date(
    paidDate && !isNaN(Date.parse(paidDate)) ? paidDate : Date.now()
  )
    .toISOString()
    .slice(0, 10);

  const normalizedName = mapPaymentMethodName(paymentMethodName);
  const paymentMethodId =
    (await ensurePaymentMethod({
      accessToken,
      realmId,
      name: normalizedName,
    })) ||
    (await ensurePaymentMethod({ accessToken, realmId, name: "Credit Card" }));

  const payload = {
    CustomerRef: { value: String(customerId) },
    TotalAmt: safeAmount,
    TxnDate: safeDate,
    PaymentRefNum: refNumber || `ref-${invoiceId}-${Date.now()}`,
    PaymentMethodRef: paymentMethodId
      ? { value: String(paymentMethodId) }
      : undefined,
    Line: [
      {
        Amount: safeAmount,
        LinkedTxn: [{ TxnId: String(invoiceId), TxnType: "Invoice" }],
      },
    ],
  };

  try {
    const res = await axios.post(
      `${QBO(realmId)}/payment?minorversion=${MINOR}`,
      payload,
      { headers: headers(accessToken) }
    );

    const payment = res.data?.Payment;
    if (!payment?.Id)
      throw new Error("QuickBooks returned invalid payment response.");

    return {
      id: payment.Id,
      totalAmt: payment.TotalAmt,
      txnDate: payment.TxnDate,
      raw: payment,
    };
  } catch (error) {
    console.warn(
      "[QBO] Payment creation failed:",
      error?.response?.data || error.message
    );
    const err = new Error(
      "Payment could not be created in QuickBooks (invalid or missing references)."
    );
    err.isPublic = true;
    err.statusCode = 400;
    throw err;
  }
}

// ---- Invoice creation ----
async function createInvoiceFromOrder({ orderId, orderType = "customer" }) {
  if (!orderId) throw new Error("Missing orderId parameter");

  const DBMODEL = orderType === "local-partner" ? PartnerOrder : Order;
  const { accessToken, realmId } = await refreshAccessTokenIfNeeded();
  if (!accessToken || !realmId) throw new Error("Missing QBO credentials");

  const order = await getOrderWithAssociations({ orderId: orderId, orderType });
  console.log(
    "🚀 ~ createInvoiceFromOrder ~ order:",
    JSON.parse(JSON.stringify(order))
  );
  if (!order) throw new Error(`Order not found with id=${orderId}`);

  if (!order.qboCustomerId) {
    const err = new Error(
      "Customer not linked with QuickBooks. Please sync first."
    );
    err.isPublic = true;
    err.statusCode = 400;
    throw err;
  }

  let invoiceId = order.quickBooksInvoiceId;
  let paymentId = order.quickBooksPaymentId;

  // 🧾 Create Invoice
  if (!invoiceId) {
    const { genericItemId } = await warmupQBOResources({
      accessToken,
      realmId,
    });

    const Lines = (order.items || []).map((it) => {
      const qty = Number(it.qty || 1);
      console.log("🚀 ~ createInvoiceFromOrder ~ qty:", qty);
      console.log("🚀 ~ createInvoiceFromOrder ~ qty:", qty);
      console.log("🚀 ~ createInvoiceFromOrder ~ qty:", qty);
      console.log("🚀 ~ createInvoiceFromOrder ~ qty:", qty);
      // `it.price` (or `it.total`) is the full total for that line
      const amount = +Number(it.price || it.total || 0).toFixed(2);
      console.log("🚀 ~ createInvoiceFromOrder ~ amount:", amount);
      console.log("🚀 ~ createInvoiceFromOrder ~ amount:", amount);
      console.log("🚀 ~ createInvoiceFromOrder ~ amount:", amount);
      console.log("🚀 ~ createInvoiceFromOrder ~ amount:", amount);
      console.log("🚀 ~ createInvoiceFromOrder ~ amount:", amount);
      console.log("🚀 ~ createInvoiceFromOrder ~ amount:", amount);
      // derive the per-unit price so QBO = Qty * UnitPrice
      const unitPrice = +(amount / qty).toFixed(2);
      console.log("🚀 ~ createInvoiceFromOrder ~ unitPrice:", unitPrice);
      console.log("🚀 ~ createInvoiceFromOrder ~ unitPrice:", unitPrice);
      console.log("🚀 ~ createInvoiceFromOrder ~ unitPrice:", unitPrice);
      console.log("🚀 ~ createInvoiceFromOrder ~ unitPrice:", unitPrice);
      console.log("🚀 ~ createInvoiceFromOrder ~ unitPrice:", unitPrice);

      return {
        Amount: amount,
        Description: `${it.product || "Coffee Product"}${
          it.grind ? ` • (${it.grind})` : ""
        }`,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: String(genericItemId) },
          Qty: qty,
          UnitPrice: unitPrice,
          TaxCodeRef: { value: "NON" },
        },
      };
    });

    // 🟢 Add Shipping Charges if > 0
    if (Number(order.shippingCharges) > 0) {
      const shipAmt = +Number(order.shippingCharges).toFixed(2);
      Lines.push({
        Amount: shipAmt,
        Description: `Shipping Charges (${order.shippingCompany || "Shipping"})`,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: String(genericItemId) },
          Qty: 1,
          UnitPrice: shipAmt,
          TaxCodeRef: { value: "NON" },
        },
      });
    }

    const payload = {
      CustomerRef: { value: String(order.qboCustomerId) },
      Line: Lines,
      TxnDate: new Date(order.invoiceDate || Date.now())
        .toISOString()
        .slice(0, 10),
      DocNumber: order.invoiceNumber || undefined,
      PrivateNote: order.note || undefined,
    };

    console.log("🚀 ~ createInvoiceFromOrder ~ payload:", payload);
    const invRes = await axios.post(
      `${QBO(realmId)}/invoice?minorversion=${MINOR}`,
      payload,
      {
        headers: headers(accessToken),
      }
    );

    const inv = invRes.data?.Invoice;
    if (!inv?.Id) throw new Error("Failed to create QuickBooks invoice");

    invoiceId = inv.Id;

    await DBMODEL.update(
      {
        quickBooksInvoiceId: invoiceId,
        invoiceSyncedToQBO: true,
        qboLastSync: new Date(),
      },
      { where: { id: orderId } }
    );
  }

  // 💳 Create Payment if status is done
  if (order.paymentStatus?.toLowerCase() === "done") {
    try {
      const paymentRes = await createPaymentForInvoice({
        accessToken,
        realmId,
        invoiceId,
        customerId: order.qboCustomerId,
        amount: order.totalBill,
        paymentMethodName: order.paymentMethod,
        refNumber: order.paymentIntentId || order.invoiceId,
        paidDate: order.invoicePaidDate,
      });

      if (paymentRes?.id) {
        paymentId = paymentRes.id;
        await DBMODEL.update(
          {
            quickBooksPaymentId: paymentRes.id,
            paymentSyncedToQBO: true,
            qboLastSync: new Date(),
          },
          { where: { id: orderId } }
        );
      }
    } catch (err) {
      console.warn("[QBO] Payment creation failed:", err.message);
      throw err;
    }
  } else {
    await DBMODEL.update(
      { qboLastSync: new Date() },
      { where: { id: orderId } }
    );
  }

  return { invoiceId, paymentId: paymentId || null, qboLastSync: new Date() };
}

module.exports = {
  createInvoiceFromOrder,
  createPaymentForInvoice,
  mapPaymentMethodName,
};
