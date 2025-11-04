// controllers/admin/qboController.js
const { exchangeFromFullUrl } = require("../../services/qboAuthService");
const {
  importCustomersToQuickBooks,
} = require("../../services/qboCustomerService");
const { createInvoiceFromOrder } = require("../../services/qboInvoice");
const {
  updateInvoiceInQuickBooks,
} = require("../../services/qboInvoiceUpdate");
const {
  syncPaymentToQuickBooks,
} = require("../../services/paymentSyncService");
const {
  refreshAccessTokenIfNeeded,
} = require("../../services/qboTokenService");
const { order } = require("../../models");
// Common HTTP response helpers
function httpError(
  res,
  status = 500,
  message = "Unexpected error",
  detail = null
) {
  return res.status(status).json({ status: "error", message, detail });
}
function httpSuccess(res, data = null, message = "OK") {
  return res.status(200).json({ status: "success", message, data });
}

/**
 * GET /qbo/auth/login
 * Redirect user to QuickBooks OAuth login page
 */
exports.authLogin = async (req, res) => {
  try {
    const clientId = process.env.QBO_CLIENT_ID;
    const redirectUri = process.env.QBO_REDIRECT_URI;
    const baseAuthUrl = "https://appcenter.intuit.com/connect/oauth2";

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope:
        "com.intuit.quickbooks.accounting openid profile email phone address",
      state: Math.random().toString(36).substring(2, 10),
    });

    const authUrl = `${baseAuthUrl}?${params.toString()}`;
    console.log("[QBO][Login] Redirecting to:", authUrl);

    return res
      .status(200)
      .json({ status: "success", data: { authUrl: authUrl } });
  } catch (err) {
    console.error("[QBO][authLogin] Error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to initiate QuickBooks login.",
    });
  }
};

/**
 * POST /qbo/auth/exchange
 * Exchange OAuth callback URL for tokens
 */
exports.authExchange = async (req, res) => {
  try {
    const { fullUrl } = req.body || {};
    console.log("🚀 ~ req.body:", req.body);

    if (!fullUrl)
      return httpError(res, 400, "Missing fullUrl from request body");
    const data = await exchangeFromFullUrl(fullUrl);
    return httpSuccess(res, data, "QuickBooks tokens saved successfully.");
  } catch (err) {
    console.error("[QBO][authExchange] Error:", err?.message);
    console.error("[QBO][authExchange] Error:", err);
    return httpError(res, 500, err.message);
  }
};

/**
 * GET /qbo/ping
 * Verify QuickBooks token validity (health check)
 */
exports.ping = async (req, res) => {
  try {
    const { accessToken, realmId } = await refreshAccessTokenIfNeeded();
    if (!accessToken || !realmId)
      return httpError(res, 401, "QuickBooks not connected.");
    return httpSuccess(res, { realmId }, "QuickBooks connection healthy.");
  } catch (err) {
    console.error("[QBO][ping] Error:", err.message);
    return httpError(res, 500, err.message);
  }
};

/**
 * POST /qbo/customers/import
 * Imports all customers from your database into QuickBooks
 */
exports.importCustomers = async (req, res) => {
  try {
    const result = await importCustomersToQuickBooks({
      limitIds: req.body.ids || [],
    });
    return httpSuccess(res, result, "Customers imported successfully.");
  } catch (err) {
    console.error("[QBO][importCustomers] Error:", err.message);
    return httpError(res, 500, err.message);
  }
};

/**
 * POST /qbo/order-invoice/create/:orderId
 * Creates a new QuickBooks Invoice for given order
 */
exports.createInvoiceForOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return httpError(res, 400, "Missing orderId parameter");
    const result = await createInvoiceFromOrder(Number(orderId));
    console.log("🚀 ~ result:", result);

    await order.update(
      { quickBooksInvoiceId: result?.id },
      { where: { id: orderId } }
    );
    return httpSuccess(
      res,
      result,
      `Invoice created successfully for order ${orderId}.`
    );
  } catch (err) {
    console.error("[QBO][createInvoiceFromOrder] Error:", err);
    return httpError(res, 500, err.message);
  }
};

/**
 * POST /qbo/order-invoice/update/:orderId
 * Updates existing QuickBooks Invoice when order changes
 */
exports.updateInvoiceForOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return httpError(res, 400, "Missing orderId parameter");
    const result = await updateInvoiceInQuickBooks(Number(orderId));
    return httpSuccess(
      res,
      result,
      `Invoice updated successfully for order ${orderId}.`
    );
  } catch (err) {
    console.error("[QBO][updateInvoiceForOrder] Error:", err.message);
    return httpError(res, 500, err.message);
  }
};

/**
 * POST /qbo/order-payment/sync/:orderId
 * Creates or updates payment in QuickBooks for a paid order
 */
exports.syncOrderPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return httpError(res, 400, "Missing orderId parameter");
    const result = await syncPaymentToQuickBooks(Number(orderId));
    return httpSuccess(
      res,
      result,
      `Payment synced successfully for order ${orderId}.`
    );
  } catch (err) {
    console.error("[QBO][syncOrderPayment] Error:", err.message);
    return httpError(res, 500, err.message);
  }
};
