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
function mapPaymentMethodName(name = "") {
  name = name.toLowerCase();

  if (name.includes("card") && name.includes("credit")) return "Credit Card";
  if (name.includes("debit")) return "Debit Card";
  if (name.includes("cash")) return "Cash";
  if (name.includes("cheque") || name.includes("check")) return "Check";
  if (name.includes("wire")) return "Wire Transfer";

  // ✅ All “bank transfer” types → ACH
  if (
    name.includes("bank") ||
    name.includes("transfer") ||
    name.includes("zelle") ||
    name.includes("venmo") ||
    name.includes("online")
  )
    return "ACH";

  return "ACH"; // safest fallback
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
  console.log("🚀 Creating QBO Payment:", {
    invoiceId,
    customerId,
    amount,
    paymentMethodName,
    refNumber,
    paidDate,
  });

  if (!accessToken || !realmId) throw new Error("Missing QBO credentials");
  if (!invoiceId || !customerId)
    throw new Error("Missing invoice or customer ID");

  /* -----------------------------------------------------------
   ✅ 1. Normalize amount + date
  ----------------------------------------------------------- */
  const safeAmount = Number(amount) || 0.01;
  const safeDate = new Date(
    paidDate && !isNaN(Date.parse(paidDate)) ? paidDate : Date.now()
  )
    .toISOString()
    .slice(0, 10);

  /* -----------------------------------------------------------
   ✅ 2. Normalize & map payment name to QBO-safe format
  ----------------------------------------------------------- */
  const normalizedName = mapPaymentMethodName(paymentMethodName);

  /* -----------------------------------------------------------
   ✅ 3. Get or Create PaymentMethod
  ----------------------------------------------------------- */
  const paymentMethodId = await ensurePaymentMethod({
    accessToken,
    realmId,
    name: normalizedName,
  });

  if (!paymentMethodId) {
    throw new Error("QBO PaymentMethod not found or could not be created.");
  }

  /* -----------------------------------------------------------
   ✅ 4. Build Payment Payload
  ----------------------------------------------------------- */
  const payload = {
    CustomerRef: { value: String(customerId) },
    TotalAmt: safeAmount,
    TxnDate: safeDate,
    PaymentRefNum: refNumber || `ref-${invoiceId}-${Date.now()}`,
    PaymentMethodRef: { value: String(paymentMethodId) },

    // ✅ REQUIRED: accounts receivable reference
    // ARAccountRef: { value: "33" }, // QBO auto-resolves this for most accounts, override if needed

    Line: [
      {
        Amount: safeAmount,
        LinkedTxn: [{ TxnId: String(invoiceId), TxnType: "Invoice" }],
      },
    ],
  };
  console.log("🚀 ~ createPaymentForInvoice ~ payload:", payload);

  /* -----------------------------------------------------------
   ✅ 5. Send Request to QBO
  ----------------------------------------------------------- */
  try {
    const res = await axios.post(
      `${QBO(realmId)}/payment?minorversion=${MINOR}`,
      payload,
      { headers: headers(accessToken) }
    );

    const payment = res.data?.Payment;

    if (!payment?.Id) throw new Error("QBO returned invalid Payment response.");

    console.log("✅ QBO Payment Created:", {
      paymentId: payment.Id,
      total: payment.TotalAmt,
      date: payment.TxnDate,
    });

    return {
      id: payment.Id,
      totalAmt: payment.TotalAmt,
      txnDate: payment.TxnDate,
      raw: payment,
    };
  } catch (error) {
    console.log("🚀 ~ createPaymentForInvoice ~ error:", error?.response?.data);
    // console.error("[QBO Payment Error]:", error?.response?.data || error);

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
  //   console.log(
  //     "🚀 ~ createInvoiceFromOrder ~ order:",
  //     JSON.parse(JSON.stringify(order))
  //   );
  //   console.log("🚀 ~ createInvoiceFromOrder ~ order:", order);
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
  console.log("🚀 ~ createInvoiceFromOrder ~ invoiceId:", invoiceId);
  console.log("🚀 ~ createInvoiceFromOrder ~ invoiceId:", invoiceId);
  console.log("🚀 ~ createInvoiceFromOrder ~ orderType:", orderType);
  if (!invoiceId) {
    // ✅ Pull all item IDs from warmup
    console.log("🚀 ~ createInvoiceFromOrder ~ success:", invoiceId);
    const { productItemId, serviceItemId, shippingItemId } =
      await warmupQBOResources({ accessToken, realmId });

    const Lines = (order.items || []).map((it) => {
      const qty = Number(it.qty || 1);
      const amount = +Number(it.price || it.total || 0).toFixed(2);
      const unitPrice = +(amount / qty).toFixed(2);

      // ✅ Decide item type
      let itemRefId;
      if (it.productId) {
        itemRefId = productItemId; // real product
      } else {
        itemRefId = serviceItemId; // extra service / manual item
      }

      return {
        Amount: amount,
        Description: `${it.product || "Item"}${
          it.grind ? ` • (${it.grind})` : ""
        }`,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: String(itemRefId) },
          Qty: qty,
          UnitPrice: unitPrice,
          TaxCodeRef: { value: "NON" },
        },
      };
    });

    // ✅ SHIPPING LINE (always uses shippingItemId)
    if (Number(order.shippingCharges) > 0) {
      const shipAmt = +Number(order?.shippingCharges || 0).toFixed(2);

      Lines.push({
        Amount: shipAmt,
        Description: `Shipping Charges (${order?.shippingCompany || "UPS"})`,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: String(shippingItemId) },
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

      // ✅ clean due date
      DueDate: new Date(
        new Date(order.invoiceDate || Date.now()).getTime() +
          (order.termDays || 30) * 86400000
      )
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
    console.log("🚀 ~ createInvoiceFromOrder ~ invoiceId:", invoiceId);
    console.log("🚀 ~ createInvoiceFromOrder ~ invoiceId:", invoiceId);
    console.log("🚀 ~ createInvoiceFromOrder ~ invoiceId:", invoiceId);
    console.log("🚀 ~ createInvoiceFromOrder ~ orderId:", orderId);

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
  }

  return { invoiceId, paymentId: paymentId || null, qboLastSync: new Date() };
}

module.exports = {
  createInvoiceFromOrder,
  createPaymentForInvoice,
  mapPaymentMethodName,
};
