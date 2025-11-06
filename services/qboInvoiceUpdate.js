// services/qboInvoiceSyncService.js
const axios = require("axios");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { getOrderWithAssociations } = require("./orderService");
const { warmupQBOResources } = require("./qboItemService");

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
  // ✅ Step 1: Get valid tokens (auto-refresh if expired)
  const { accessToken, realmId } = await refreshAccessTokenIfNeeded();
  if (!accessToken || !realmId) throw new Error("Missing QBO credentials");

  // ✅ Step 2: Ensure QBO base resources (generic item, etc.)
  const { genericItemId } = await warmupQBOResources({ accessToken, realmId });

  // ✅ Step 3: Fetch order details
  const orderData = await getOrderWithAssociations({ orderId, orderType });
  if (!orderData) throw new Error(`Order not found with id=${orderId}`);
  if (!orderData.quickBooksInvoiceId)
    throw new Error("No linked QuickBooks invoice on this order.");

  const invoiceId = orderData.quickBooksInvoiceId;

  // ✅ Step 4: Fetch current invoice from QBO (to get SyncToken)
  const getUrl = `${QBO(realmId)}/invoice/${invoiceId}?minorversion=${MINOR}`;
  const { data: currentData } = await axios.get(getUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const currentInvoice = currentData?.Invoice;
  if (!currentInvoice)
    throw new Error(`Failed to fetch current invoice ${invoiceId} from QBO.`);

  // ✅ Skip if already paid (Balance = 0)
  if (Number(currentInvoice.Balance || 0) === 0) {
    console.log(
      `[QBO][InvoiceSync] Skipped update — invoice ${invoiceId} is already paid.`
    );
    return currentInvoice;
  }

  // ✅ Step 5: Build updated invoice lines
  const Lines = (orderData.items || []).map((it) => ({
    Amount: Number(it.price || 0),
    Description: it.product || it.productName || "Item",
    DetailType: "SalesItemLineDetail",
    SalesItemLineDetail: {
      Qty: it.qty || 1,
      UnitPrice: it.price / it.qty || 0,
      TaxCodeRef: { value: "NON" },
    },
  }));

  // ➕ Include Shipping Charges if present
  if (Number(orderData.shippingCharges) > 0) {
    Lines.push({
      Amount: +Number(orderData.shippingCharges).toFixed(2),
      Description: `Shipping Charges (${orderData.shippingCompany || "Shipping"})`,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: String(genericItemId) },
        Qty: 1,
        UnitPrice: +Number(orderData.shippingCharges).toFixed(2),
        TaxCodeRef: { value: "NON" },
      },
    });
  }

  // ✅ Step 6: Build sparse update payload with SyncToken
  const payload = {
    Id: String(invoiceId),
    SyncToken: currentInvoice.SyncToken, // ✅ Required to prevent stale error
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

  // ✅ Step 7: Send update request
  const url = `${QBO(realmId)}/invoice?minorversion=${MINOR}`;
  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  console.log(`[QBO][InvoiceSync] ✅ Updated invoice ${invoiceId}`, {
    total: res.data?.Invoice?.TotalAmt,
  });

  return res.data?.Invoice;
}

module.exports = { updateInvoiceInQuickBooks };
