// services/qboInvoiceSyncService.js
const axios = require("axios");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { getOrderWithAssociations } = require("./orderService");
const { warmupQBOResources } = require("./qboItemService");
const { handleQboError } = require("./qboErrorHandler");
const { order, partnerOrder } = require("../models");
const Order = order;
const PartnerOrder = partnerOrder;
const BASE =
  (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const QBO = (realmId) => `${BASE}/v3/company/${realmId}`;
const MINOR = 70;

/**
 * Build QBO Invoice Payload (Lines + Shipping + Sparse Payload)
 * Does NOT send to QBO — only PREPARES the payload.
 */
function buildQboInvoiceUpdatePayload({
  order,
  qboInvoiceId,
  syncToken,
  productItemId,
  serviceItemId,
  shippingItemId,
}) {
  /* -------------------------------------------------------
      3. Build line items
  --------------------------------------------------------*/
  const Lines = [];

  for (const it of order.items || []) {
    const qty = Number(it.qty || 1);
    const amount = +Number(it.price || it.total || 0).toFixed(2);
    const unitPrice = +(amount / qty).toFixed(2);

    const itemRef = it.productId ? productItemId : serviceItemId;

    Lines.push({
      Amount: amount,
      Description: it.product || it.productName || "Item",
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: String(itemRef) },
        Qty: qty,
        UnitPrice: unitPrice,
        TaxCodeRef: { value: "NON" },
      },
    });
  }

  /* -------------------------------------------------------
      4. Add shipping line
  --------------------------------------------------------*/
  if (Number(order.shippingCharges) > 0) {
    const shipAmt = +Number(order.shippingCharges).toFixed(2);

    Lines.push({
      Amount: shipAmt,
      Description: `Shipping Charges ${order.shippingCompany || "UPS"}`,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: String(shippingItemId) },
        Qty: 1,
        UnitPrice: shipAmt,
        TaxCodeRef: { value: "NON" },
      },
    });
  }

  /* -------------------------------------------------------
      5. Build sparse payload
  --------------------------------------------------------*/
  return {
    Id: String(qboInvoiceId),
    SyncToken: syncToken,
    sparse: true,
    CustomerRef: {
      value: String(order.qboCustomerId),
    },
    Line: Lines,
    PrivateNote: order.note || undefined,

    TxnDate: new Date(order.invoiceDate || Date.now())
      .toISOString()
      .slice(0, 10),

    DueDate: new Date(
      new Date(order.invoiceDate || Date.now()).getTime() +
        (order.termDays || 30) * 86400000
    )
      .toISOString()
      .slice(0, 10),

    ShipAddr: order.address
      ? {
          Line1: order.address.addressLineOne,
          City: order.address.city,
          CountrySubDivisionCode: order.address.state,
          PostalCode: order.address.zipCode,
          Country: order.address.country,
        }
      : undefined,
  };
}

/**
 * Update an existing QuickBooks invoice with latest order data.
 * Handles SyncToken versioning and skips if invoice is paid.
 */

async function updateInvoiceInQuickBooks({
  accessToken,
  realmId,
  order,
  qboInvoiceId,
  MODEL = Order,
}) {
  try {
    console.log("🚀 updateInvoiceInQuickBooks:", { orderId: order?.id });
    console.log("🚀 updateInvoiceInQuickBooks:", {
      orderId: order?.qboCustomerId,
    });
    console.log("🚀 ~ updateInvoiceInQuickBooks ~ accessToken:", accessToken);
    console.log("🚀 ~ updateInvoiceInQuickBooks ~ realmId:", realmId);
    console.log("🚀 ~ updateInvoiceInQuickBooks ~ qboInvoiceId:", qboInvoiceId);

    if (!accessToken || !realmId) throw new Error("Missing QBO credentials");
    if (!order) throw new Error("Order not found");
    if (!qboInvoiceId) throw new Error("No QBO invoice linked.");

    /* -------------------------------------------------------
        1. Warmup items
    --------------------------------------------------------*/
    const { productItemId, serviceItemId, shippingItemId } =
      await warmupQBOResources({ accessToken, realmId });

    console.log(
      `🚀 ~ updateInvoiceInQuickBooks ~ { productItemId, serviceItemId, shippingItemId }:`,
      { productItemId, serviceItemId, shippingItemId }
    );
    /* -------------------------------------------------------
        2. Fetch existing invoice
    --------------------------------------------------------*/
    const getUrl = `${QBO(realmId)}/invoice/${qboInvoiceId}?minorversion=${MINOR}`;
    const invRes = await axios.get(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const currentInvoice = invRes?.data?.Invoice;
    if (!currentInvoice)
      throw new Error(`Could not load invoice ${qboInvoiceId}`);

    // Skip if paid
    if (Number(currentInvoice.Balance || 0) === 0) {
      console.log(
        `[QBO] Skipping update — invoice ${qboInvoiceId} already paid.`
      );
      return currentInvoice;
    }

    /* -------------------------------------------------------
        3 + 4 + 5 = Build Sparse Payload via helper
    --------------------------------------------------------*/
    const payload = buildQboInvoiceUpdatePayload({
      order,
      qboInvoiceId,
      syncToken: currentInvoice.SyncToken,
      productItemId,
      serviceItemId,
      shippingItemId,
    });
    console.log("🚀 ~ updateInvoiceInQuickBooks ~ payload:", payload);

    /* -------------------------------------------------------
        6. Send update request
    --------------------------------------------------------*/
    const postUrl = `${QBO(realmId)}/invoice?minorversion=${MINOR}`;
    const res = await axios.post(postUrl, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    /* -------------------------------------------------------
        7. Update DB
    --------------------------------------------------------*/
    await MODEL.update(
      { qboLastSync: new Date() },
      { where: { id: order.id } }
    );

    console.log(`[QBO] ✅ Invoice updated ${qboInvoiceId} =  ${realmId}`);

    return res.data?.Invoice;
  } catch (err) {
    handleQboError({
      err,
      context: "❌ [QBO][UPDATE INVOICE ERROR]:",
    });
    // throw err;
  }
}

module.exports = { updateInvoiceInQuickBooks };

// async function updateInvoiceInQuickBooks({ orderId, orderType = "customer" }) {
//   console.log("🚀 updateInvoiceInQuickBooks:", { orderId, orderType });

//   // ✅ Step 1: Get access token
//   const { accessToken, realmId } = await refreshAccessTokenIfNeeded();
//   if (!accessToken || !realmId) throw new Error("Missing QBO credentials");

//   // ✅ Step 2: Warm up all item types ONCE
//   // ✅ Step 2: Get all item IDs at once
//   const { productItemId, serviceItemId, shippingItemId } =
//     await warmupQBOResources({ accessToken, realmId });

//   // ✅ Step 3: Load order
//   const ord = await getOrderWithAssociations({ orderId, orderType });
//   if (!ord) throw new Error(`Order not found with id=${orderId}`);
//   if (!ord.quickBooksInvoiceId)
//     throw new Error("No QuickBooks invoice linked with this order.");

//   const invoiceId = ord.quickBooksInvoiceId;

//   // ✅ Step 4: Fetch current invoice (to get SyncToken)
//   const getUrl = `${QBO(realmId)}/invoice/${invoiceId}?minorversion=${MINOR}`;
//   const invRes = await axios.get(getUrl, {
//     headers: { Authorization: `Bearer ${accessToken}` },
//   });

//   const currentInvoice = invRes?.data?.Invoice;
//   if (!currentInvoice)
//     throw new Error(`Could not load invoice ${invoiceId} from QBO.`);

//   // ✅ Skip updating a paid invoice
//   if (Number(currentInvoice.Balance || 0) === 0) {
//     console.log(
//       `[QBO] Skipping update — invoice ${invoiceId} already paid/completed.`
//     );
//     return currentInvoice;
//   }

//   // ✅ Step 5: Build Line Items (PRODUCT / SERVICE / SHIPPING)
//   const Lines = [];

//   for (const it of ord.items || []) {
//     const qty = Number(it.qty || 1);
//     const amount = +Number(it.price || it.total || 0).toFixed(2);
//     const unitPrice = +(amount / qty).toFixed(2);

//     // ✅ Choose the correct ItemRef
//     let itemRef = serviceItemId; // default

//     if (it.productId)
//       itemRef = productItemId; // Product line
//     else itemRef = serviceItemId; // Service line

//     Lines.push({
//       Amount: amount,
//       Description: it.product || it.productName || "Item",
//       DetailType: "SalesItemLineDetail",
//       SalesItemLineDetail: {
//         ItemRef: { value: String(itemRef) },
//         Qty: qty,
//         UnitPrice: unitPrice,
//         TaxCodeRef: { value: "NON" },
//       },
//     });
//   }

//   // ✅ Step 6: Add Shipping Line
//   if (Number(ord.shippingCharges) > 0) {
//     const shipAmt = +Number(ord.shippingCharges).toFixed(2);

//     Lines.push({
//       Amount: shipAmt,
//       Description: `Shipping Charges ${ord.shippingCompany || "UPS"}`,
//       DetailType: "SalesItemLineDetail",
//       SalesItemLineDetail: {
//         ItemRef: { value: String(shippingItemId) },
//         Qty: 1,
//         UnitPrice: shipAmt,
//         TaxCodeRef: { value: "NON" },
//       },
//     });
//   }

//   // ✅ Step 7: Build sparse update payload
//   const payload = {
//     Id: String(invoiceId),
//     SyncToken: currentInvoice.SyncToken,
//     sparse: true,
//     Line: Lines,

//     PrivateNote: ord.note || undefined,

//     TxnDate: new Date(ord.invoiceDate || Date.now()).toISOString().slice(0, 10),

//     DueDate: new Date(Date.now() + (ord.termDays || 30) * 86400000)
//       .toISOString()
//       .slice(0, 10),

//     ShipAddr: ord.address
//       ? {
//           Line1: ord.address.addressLineOne,
//           City: ord.address.city,
//           CountrySubDivisionCode: ord.address.state,
//           PostalCode: ord.address.zipCode,
//           Country: ord.address.country,
//         }
//       : undefined,
//   };

//   // ✅ Step 8: Send update request
//   const postUrl = `${QBO(realmId)}/invoice?minorversion=${MINOR}`;
//   const res = await axios.post(postUrl, payload, {
//     headers: {
//       Authorization: `Bearer ${accessToken}`,
//       Accept: "application/json",
//       "Content-Type": "application/json",
//     },
//   });

//   // ✅ Step 9: Update DB timestamp
//   const DBMODEL = orderType === "local-partner" ? PartnerOrder : Order;

//   await DBMODEL.update({ qboLastSync: new Date() }, { where: { id: orderId } });

//   console.log(`[QBO] ✅ Invoice updated ${invoiceId}`, {
//     total: res.data?.Invoice?.TotalAmt,
//   });

//   return res.data?.Invoice;
// }
