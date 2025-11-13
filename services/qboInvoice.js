// services/qboInvoice.js
const axios = require("axios");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { getOrderWithAssociations } = require("./orderService");
const { ensureItemByName, warmupQBOResources } = require("./qboItemService");
const { order, partnerOrder, account, qboCustomerMap } = require("../models");
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
  invoiceNumber,
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

  if (invoiceNumber) {
    payload.PrivateNote = `Order Invoice ID: ${invoiceNumber}`;
  }
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

async function createQboPayment({ order, invoiceId, accessToken, realmId }) {
  try {
    console.log("⚡ [QBO] Creating Payment for invoice:", invoiceId);

    const paymentRes = await createPaymentForInvoice({
      accessToken,
      realmId,
      invoiceId,
      customerId: order.qboCustomerId,
      amount: order.totalBill,
      paymentMethodName: order.paymentMethod,
      refNumber: order.paymentIntentId || order.invoiceId,
      paidDate: order.invoicePaidDate,
      invoiceNumber: order.invoiceNumber,
    });

    const paymentId = paymentRes?.id;
    if (!paymentId) throw new Error("QBO Payment creation failed.");

    console.log("✅ [QBO] Payment Created:", paymentId);

    return { paymentId };
  } catch (err) {
    console.error("❌ [QBO Payment ERROR]:", err.message);
    console.error(err); // full stack
    throw err;
  }
}

async function createQboInvoice({ order, accessToken, realmId }) {
  try {
    console.log("⚡ [QBO] Creating Invoice for Order:", order?.id);

    // Warmup product/service IDs
    const { productItemId, serviceItemId, shippingItemId } =
      await warmupQBOResources({ accessToken, realmId });

    const Lines = (order.items || []).map((it) => {
      const qty = Number(it.qty || 1);
      const amount = +Number(it.price || it.total || 0).toFixed(2);
      const unitPrice = +(amount / qty).toFixed(2);

      return {
        Amount: amount,
        Description: `${it.product || "Item"}${it.grind ? ` • (${it.grind})` : ""}`,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: {
            value: String(it.productId ? productItemId : serviceItemId),
          },
          Qty: qty,
          UnitPrice: unitPrice,
          TaxCodeRef: { value: "NON" },
        },
      };
    });

    // Add shipping charge if exists
    if (Number(order.shippingCharges) > 0) {
      const shipAmt = +Number(order.shippingCharges).toFixed(2);
      Lines.push({
        Amount: shipAmt,
        Description: `Shipping Charges (${order.shippingCompany || "UPS"})`,
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
      DueDate: new Date(
        new Date(order.invoiceDate || Date.now()).getTime() +
          (order.termDays || 30) * 86400000
      )
        .toISOString()
        .slice(0, 10),
      DocNumber: order.invoiceNumber || undefined,
      PrivateNote: order.note || undefined,
    };

    console.log("⚡ [QBO] Invoice Payload:", payload);

    const invRes = await axios.post(
      `${QBO(realmId)}/invoice?minorversion=${MINOR}`,
      payload,
      { headers: headers(accessToken) }
    );

    const invoiceId = invRes?.data?.Invoice?.Id;
    if (!invoiceId) throw new Error("Failed to create QuickBooks Invoice");

    console.log("✅ [QBO] Invoice Created:", invoiceId);

    return { invoiceId, payload, invRes };
  } catch (err) {
    console.error("❌ [QBO Invoice ERROR]:", err.message);
    console.error(err.stack); // full stack
    throw err;
  }
}
async function updateOrderRecord({ orderId, input = {}, MODEL = Order }) {
  if (!orderId) throw new Error("Missing orderId");
  try {
    await MODEL.update(
      { ...input, qboLastSync: new Date() },
      { where: { id: orderId } }
    );

    console.log(`[QBO][OrderUpdate] Updated order ${orderId}:`, input);
  } catch (err) {
    console.error(`[QBO][OrderUpdate] ❌ Failed for order ${orderId}`, err);
    console.error(
      `[QBO][OrderUpdate] ❌ Failed for order ${orderId}`,
      err?.stack
    );
    throw err; // keep error bubbling
  }
}

// HANDLES INVOICE SYN and PAyment sync On ADMIN QBO
async function handleAdminQboSync({
  order,
  orderType,
  orderId,
  ADMIN,
  DBMODEL,
}) {
  try {
    if (!order?.quickBooksInvoiceId && ADMIN?.currentRealmId) {
      const adminQboCondition = {
        realmId: ADMIN?.currentRealmId,
        accountId: ADMIN.id,
      };

      const customerOrPartnerCondition = { ...adminQboCondition };
      if (orderType == "customer") {
        customerOrPartnerCondition.userId = order.userId;
      } else if (orderType == "local-partner") {
        customerOrPartnerCondition.salesRepId = order.salesRepId;
      }

      const qboCustomerOnAdmin = await qboCustomerMap.findOne({
        where: customerOrPartnerCondition,
      });

      if (qboCustomerOnAdmin?.qboCustomerId) {
        order.qboCustomerId = qboCustomerOnAdmin.qboCustomerId;

        const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
          condition: adminQboCondition,
        });

        if (accessToken && realmId) {
          const adminQboInvoice = await createQboInvoice({
            order,
            accessToken,
            realmId,
          });

          updateOrderRecord({
            orderId,
            input: { quickBooksInvoiceId: adminQboInvoice?.invoiceId },
            MODEL: DBMODEL,
          });

          if (!order.quickBooksPaymentId && order?.paymentStatus == "done") {
            const adminQboPayment = await createQboPayment({
              order,
              invoiceId: adminQboInvoice?.invoiceId,
              accessToken,
              realmId,
            });

            updateOrderRecord({
              orderId,
              input: { quickBooksPaymentId: adminQboPayment?.paymentId },
              MODEL: DBMODEL,
            });
          }
        } else {
          console.log("🚀 ~ ADMIN QBO ACCOUNT NOT CONNECTED");
        }
      } else {
        console.log("🚀 ~ ADMIN QBO CUSTOMER NOT CONNECTED");
      }
    }
  } catch (err) {
    console.log("🔥 ERROR in handleAdminQboSync:");
    console.log(err.stack || err.message);
  }
}

// HANDLES INVOICE SYN and PAyment sync On local Partner QBO
async function handlePartnerQboSync({ order, orderType, orderId, DBMODEL }) {
  try {
    const quickBooksInvoiceIdPartner = order?.quickBooksInvoiceIdPartner;

    if (
      orderType == "customer" &&
      order?.partnerCurrentRealmId &&
      !quickBooksInvoiceIdPartner
    ) {
      const partnerQboCondition = {
        realmId: order?.partnerCurrentRealmId,
        salesRepId: order.salesRepId,
      };

      const customerCondition = {
        ...partnerQboCondition,
        userId: order?.userId,
      };

      const qboCustomerOnPartner = await qboCustomerMap.findOne({
        where: customerCondition,
      });

      if (qboCustomerOnPartner?.qboCustomerId) {
        order.qboCustomerId = qboCustomerOnPartner?.qboCustomerId;

        const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
          condition: partnerQboCondition,
        });

        if (accessToken && realmId) {
          const partnerQboInvoice = await createQboInvoice({
            order,
            accessToken,
            realmId,
          });

          updateOrderRecord({
            orderId,
            input: {
              quickBooksInvoiceIdPartner: partnerQboInvoice?.invoiceId,
            },
            MODEL: DBMODEL,
          });

          if (
            !order.quickBooksPaymentIdPartner &&
            order?.paymentStatus == "done"
          ) {
            const partnerQboPayment = await createQboPayment({
              order,
              invoiceId: partnerQboInvoice?.invoiceId,
              accessToken,
              realmId,
            });

            updateOrderRecord({
              orderId,
              input: {
                quickBooksPaymentIdPartner: partnerQboPayment?.paymentId,
              },
              MODEL: DBMODEL,
            });
          }
        } else {
          console.log("🚀 ~ LOCAL PARTNER QBO ACCOUNT NOT CONNECTED");
        }
      } else {
        console.log("🚀 ~ LOCAL PARTNER QBO CUSTOMER NOT CONNECTED");
      }
    }
  } catch (err) {
    console.log("🔥 ERROR in handlePartnerQboSync:");
    console.log(err.stack || err.message);
  }
}

// ---- Invoice creation ----
async function createInvoiceFromOrder({ orderId, orderType = "customer" }) {
  if (!orderId) throw new Error("Missing orderId");

  const DBMODEL = orderType === "local-partner" ? PartnerOrder : Order;
  const order = await getOrderWithAssociations({ orderId, orderType });
  if (!order) throw new Error(`Order not found id=${orderId}`);

  let ADMIN = await account.findOne({});

  // -------------------------------
  // 🔹 ADMIN SYNC
  // -------------------------------
  await handleAdminQboSync({ order, orderType, orderId, ADMIN, DBMODEL });

  // -------------------------------
  // 🔹 PARTNER SYNC
  // -------------------------------
  await handlePartnerQboSync({ order, orderType, orderId, DBMODEL });

  return {
    message: `Quickbooks inovice sync success for order #${orderId}`,
  };
}

module.exports = {
  createInvoiceFromOrder,
  createPaymentForInvoice,
  mapPaymentMethodName,
};
