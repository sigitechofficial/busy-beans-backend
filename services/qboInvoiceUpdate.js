// services/qboInvoiceSyncService.js
const axios = require("axios");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { getOrderWithAssociations } = require("./orderService");
const { warmupQBOResources } = require("./qboItemService");
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
 * Update an existing QuickBooks invoice with latest order data.
 * Handles SyncToken versioning and skips if invoice is paid.
 */
async function updateInvoiceInQuickBooks({ orderId, orderType = "customer" }) {
  console.log("🚀 updateInvoiceInQuickBooks:", { orderId, orderType });

  // ✅ Step 1: Get access token
  const { accessToken, realmId } = await refreshAccessTokenIfNeeded();
  if (!accessToken || !realmId) throw new Error("Missing QBO credentials");

  // ✅ Step 2: Warm up all item types ONCE
  // ✅ Step 2: Get all item IDs at once
  const { productItemId, serviceItemId, shippingItemId } =
    await warmupQBOResources({ accessToken, realmId });

  // ✅ Step 3: Load order
  const ord = await getOrderWithAssociations({ orderId, orderType });
  if (!ord) throw new Error(`Order not found with id=${orderId}`);
  if (!ord.quickBooksInvoiceId)
    throw new Error("No QuickBooks invoice linked with this order.");

  const invoiceId = ord.quickBooksInvoiceId;

  // ✅ Step 4: Fetch current invoice (to get SyncToken)
  const getUrl = `${QBO(realmId)}/invoice/${invoiceId}?minorversion=${MINOR}`;
  const invRes = await axios.get(getUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const currentInvoice = invRes?.data?.Invoice;
  if (!currentInvoice)
    throw new Error(`Could not load invoice ${invoiceId} from QBO.`);

  // ✅ Skip updating a paid invoice
  if (Number(currentInvoice.Balance || 0) === 0) {
    console.log(
      `[QBO] Skipping update — invoice ${invoiceId} already paid/completed.`
    );
    return currentInvoice;
  }

  // ✅ Step 5: Build Line Items (PRODUCT / SERVICE / SHIPPING)
  const Lines = [];

  for (const it of ord.items || []) {
    const qty = Number(it.qty || 1);
    const amount = +Number(it.price || it.total || 0).toFixed(2);
    const unitPrice = +(amount / qty).toFixed(2);

    // ✅ Choose the correct ItemRef
    let itemRef = serviceItemId; // default

    if (it.productId)
      itemRef = productItemId; // Product line
    else itemRef = serviceItemId; // Service line

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

  // ✅ Step 6: Add Shipping Line
  if (Number(ord.shippingCharges) > 0) {
    const shipAmt = +Number(ord.shippingCharges).toFixed(2);

    Lines.push({
      Amount: shipAmt,
      Description: `Shipping Charges ${ord.shippingCompany || "UPS"}`,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: String(shippingItemId) },
        Qty: 1,
        UnitPrice: shipAmt,
        TaxCodeRef: { value: "NON" },
      },
    });
  }

  // ✅ Step 7: Build sparse update payload
  const payload = {
    Id: String(invoiceId),
    SyncToken: currentInvoice.SyncToken,
    sparse: true,
    Line: Lines,

    PrivateNote: ord.note || undefined,

    TxnDate: new Date(ord.invoiceDate || Date.now()).toISOString().slice(0, 10),

    DueDate: new Date(Date.now() + (ord.termDays || 30) * 86400000)
      .toISOString()
      .slice(0, 10),

    ShipAddr: ord.address
      ? {
          Line1: ord.address.addressLineOne,
          City: ord.address.city,
          CountrySubDivisionCode: ord.address.state,
          PostalCode: ord.address.zipCode,
          Country: ord.address.country,
        }
      : undefined,
  };

  // ✅ Step 8: Send update request
  const postUrl = `${QBO(realmId)}/invoice?minorversion=${MINOR}`;
  const res = await axios.post(postUrl, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  // ✅ Step 9: Update DB timestamp
  const DBMODEL = orderType === "local-partner" ? PartnerOrder : Order;

  await DBMODEL.update({ qboLastSync: new Date() }, { where: { id: orderId } });

  console.log(`[QBO] ✅ Invoice updated ${invoiceId}`, {
    total: res.data?.Invoice?.TotalAmt,
  });

  return res.data?.Invoice;
}

module.exports = { updateInvoiceInQuickBooks };
