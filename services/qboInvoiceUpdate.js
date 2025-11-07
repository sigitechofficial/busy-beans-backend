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
  console.log("🚀 ~ updateInvoiceInQuickBooks ~ orderId:", orderId);
  console.log("🚀 ~ updateInvoiceInQuickBooks ~ orderType:", orderType);

  // ✅ Step 1: Get valid tokens (auto-refresh if expired)
  const { accessToken, realmId } = await refreshAccessTokenIfNeeded();
  if (!accessToken || !realmId) throw new Error("Missing QBO credentials");

  // ✅ Step 2: Ensure QBO base resources (generic item, etc.)
  const { genericItemId } = await warmupQBOResources({ accessToken, realmId });

  // ✅ Step 3: Fetch order details
  const order = await getOrderWithAssociations({ orderId, orderType });
  if (!order) throw new Error(`Order not found with id=${orderId}`);
  if (!order.quickBooksInvoiceId)
    throw new Error("No linked QuickBooks invoice on this order.");

  const invoiceId = order.quickBooksInvoiceId;

  // ✅ Step 4: Fetch current invoice (to get SyncToken)
  const getUrl = `${QBO(realmId)}/invoice/${invoiceId}?minorversion=${MINOR}`;
  const { data: currentData } = await axios.get(getUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const currentInvoice = currentData?.Invoice;
  if (!currentInvoice)
    throw new Error(`Failed to fetch current invoice ${invoiceId} from QBO.`);

  // ✅ Skip if already paid
  if (Number(currentInvoice.Balance || 0) === 0) {
    console.log(
      `[QBO][InvoiceSync] Skipped update — invoice ${invoiceId} is already paid.`
    );
    return currentInvoice;
  }

  // ✅ Step 5: Build Lines (same logic as createInvoiceFromOrder)
  const Lines = (order.items || []).map((it) => {
    const qty = Number(it.qty || 1);
    const amount = +Number(it.price || it.total || 0).toFixed(2);
    const unitPrice = +(amount / qty).toFixed(2);

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

  // ➕ Include Shipping Charges if > 0
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

  // ✅ Step 6: Prepare sparse update payload
  const payload = {
    Id: String(invoiceId),
    SyncToken: currentInvoice.SyncToken,
    sparse: true,
    Line: Lines,
    PrivateNote: order.note || undefined,
    TxnDate: new Date(order.invoiceDate || Date.now())
      .toISOString()
      .slice(0, 10),
    DueDate: new Date(Date.now() + (order.termDays || 30) * 24 * 60 * 60 * 1000)
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

  // ✅ Step 7: Send update request to QBO
  const url = `${QBO(realmId)}/invoice?minorversion=${MINOR}`;
  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  // ✅ Step 8: Update local DB sync timestamp
  const DBMODEL = orderType === "local-partner" ? PartnerOrder : Order;
  await DBMODEL.update({ qboLastSync: new Date() }, { where: { id: orderId } });

  console.log(`[QBO][InvoiceSync] ✅ Updated invoice ${invoiceId}`, {
    total: res.data?.Invoice?.TotalAmt,
  });

  return res.data?.Invoice;
}

module.exports = { updateInvoiceInQuickBooks };
