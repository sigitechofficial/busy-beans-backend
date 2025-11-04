// services/qboInvoiceSyncService.js
const axios = require("axios");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { getOrderWithAssociations } = require("./orderService");

const BASE =
  (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const QBO = (realmId) => `${BASE}/v3/company/${realmId}`;
const MINOR = 70;

/**
 * Update QuickBooks invoice when order data changes.
 */
async function updateInvoiceInQuickBooks(orderId) {
  // 1. Refresh access token
  const { accessToken, realmId } = await refreshAccessTokenIfNeeded();
  if (!accessToken || !realmId) throw new Error("Missing QBO credentials");

  // 2. Fetch order from shared service (reused logic!)
  const orderData = await getOrderWithAssociations(orderId);
  if (!orderData) throw new Error(`Order not found with id=${orderId}`);

  if (!orderData.quickBooksInvoiceId)
    throw new Error("No linked QuickBooks invoice on this order.");

  const invoiceId = orderData.quickBooksInvoiceId;

  // 3. Build sparse update payload
  const Lines = (orderData.items || []).map((it) => ({
    Amount: Number(it.price * it.qty || 0),
    Description: it.product || it.productName || "Item",
    DetailType: "SalesItemLineDetail",
    SalesItemLineDetail: {
      Qty: it.qty || 1,
      UnitPrice: it.price || 0,
      TaxCodeRef: { value: "NON" },
    },
  }));

  const payload = {
    Id: String(invoiceId),
    sparse: true,
    Line: Lines,
    PrivateNote: orderData.note || undefined,
    TxnDate: new Date(orderData.invoiceDate || Date.now())
      .toISOString()
      .slice(0, 10),
    DueDate: orderData.termDays
      ? new Date(Date.now() + orderData.termDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
      : undefined,
    ShipAddr: orderData.address
      ? {
          Line1: orderData.address.addressLineOne,
          City: orderData.address.city,
          CountrySubDivisionCode: orderData.address.state,
          PostalCode: orderData.address.zipCode,
          Country: orderData.address.country,
        }
      : undefined,
  };

  // 4. Send update request to QuickBooks
  const url = `${QBO(realmId)}/invoice?minorversion=${MINOR}`;
  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  console.log(`[QBO][InvoiceSync] Updated invoice ${invoiceId}`, {
    total: res.data?.Invoice?.TotalAmt,
  });

  return res.data?.Invoice;
}

module.exports = { updateInvoiceInQuickBooks };
