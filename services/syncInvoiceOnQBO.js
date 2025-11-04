//contoller/quickBooksFactory.js
// created function that we will use in our app controllers to create invoices in QuickBooks and customer and mark payments
// controllers/admin/qboController.js
const { exchangeFromFullUrl } = require("./qboAuthService");
const { importCustomersToQuickBooks } = require("./qboCustomerService");
const { createInvoiceFromOrder } = require("./qboInvoice");
const { updateInvoiceInQuickBooks } = require("./qboInvoiceUpdate");
const { syncPaymentToQuickBooks } = require("./paymentSyncService");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { order } = require("../models");
// Common HTTP response helpers

exports.syncInvoiceOnQuikBooks = async (orderId) => {
  try {
    const result = await createInvoiceFromOrder(Number(orderId));
    console.log("🚀 ~ result:", result);
    return result;
  } catch (err) {
    {
      console.error("[QBO][syncInvoiceOnQuikBooks] Error:", err);

      // ✅ Re-throw the *same* error so controller gets its original fields
      if (err.isPublic) throw err; // safe, user-facing error
      if (err.response?.data?.Fault) {
        // If QuickBooks API sends structured error, wrap it cleanly
        const qbErr = new Error(
          err.response.data.Fault.Error?.[0]?.Message ||
            "QuickBooks API error occurred."
        );
        qbErr.statusCode = 400;
        qbErr.isPublic = true;
        throw qbErr;
      }

      // fallback — unexpected error
      const genericErr = new Error(
        "An unexpected error occurred while syncing invoice with QuickBooks."
      );
      genericErr.statusCode = 500;
      genericErr.isPublic = true;
      throw genericErr;
    }
  }
};

exports.updateInvoiceOnQuickBooks = async (orderId) => {
  try {
    const result = await updateInvoiceInQuickBooks(Number(orderId));
    await order.update({ qboLastSync: new Date() }, { where: { id: orderId } });
    return result;
  } catch (err) {
    {
      console.error("[QBO][syncInvoiceOnQuikBooks] Error:", err);

      // ✅ Re-throw the *same* error so controller gets its original fields
      if (err.isPublic) throw err; // safe, user-facing error
      if (err.response?.data?.Fault) {
        // If QuickBooks API sends structured error, wrap it cleanly
        const qbErr = new Error(
          err.response.data.Fault.Error?.[0]?.Message ||
            "QuickBooks API error occurred."
        );
        qbErr.statusCode = 400;
        qbErr.isPublic = true;
        throw qbErr;
      }

      // fallback — unexpected error
      const genericErr = new Error(
        "An unexpected error occurred while syncing invoice with QuickBooks."
      );
      genericErr.statusCode = 500;
      genericErr.isPublic = true;
      throw genericErr;
    }
  }
};
