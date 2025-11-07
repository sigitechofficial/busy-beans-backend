//contoller/quickBooksFactory.js
// created function that we will use in our app controllers to create invoices in QuickBooks and customer and mark payments
// controllers/admin/qboController.js
const { exchangeFromFullUrl } = require("./qboAuthService");
const { importCustomersToQuickBooks } = require("./qboCustomerService");
const { createInvoiceFromOrder } = require("./qboInvoice");
const { updateInvoiceInQuickBooks } = require("./qboInvoiceUpdate");
const { syncPaymentToQuickBooks } = require("./paymentSyncService");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { quickBooksInvocieDelete } = require("./qboDeleteInvoice");
const { order } = require("../models");
// Common HTTP response helpers

exports.syncInvoiceOnQuikBooks = async ({
  orderId,
  orderType = "customer",
}) => {
  console.log("🚀 ~ syncInvoiceOnQuikBooks:", orderId);
  try {
    const result = await createInvoiceFromOrder({
      orderId: Number(orderId),
      orderType,
    });
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

exports.updateInvoiceOnQuickBooks = async ({ orderId, orderType }) => {
  try {
    const result = await updateInvoiceInQuickBooks({
      orderId: Number(orderId),
      orderType,
    });
    return result;
  } catch (err) {
    {
      console.error("[QBO][syncInvoiceOnQuikBooks] Error:", err?.stack);

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

exports.bulkImportOrders = async ({ orderIds = [] }) => {
  const results = [];
  for (const id of orderIds) {
    try {
      const res = await createInvoiceFromOrder({ orderId: id });
      console.log("🚀 ~ bulkImportOrders ~ res:", res);
      results.push({ orderId: id, status: "success", data: res });
    } catch (err) {
      console.error(`[BulkImport] Order ${id} failed:`, err.message);
      results.push({ orderId: id, status: "failed", error: err.message });
    }
    await new Promise((r) => setTimeout(r, 300)); // prevent QBO API throttling
  }
  return results;
};

exports.bulkSyncPayments = async ({ orderIds = [] }) => {
  const results = [];

  for (const id of orderIds) {
    try {
      const res = await syncPaymentToQuickBooks({ orderId: id });
      results.push({
        orderId: id,
        status: "success",
        data: res,
      });
    } catch (err) {
      console.error(
        `[QBO][BulkPaymentSync] Failed for order ${id}:`,
        err.message
      );
      results.push({ orderId: id, status: "failed", error: err.message });
    }

    // Prevent QuickBooks API throttling (500/minute)
    await new Promise((r) => setTimeout(r, 300));
  }

  return results;
};

async function bulkProcess(items = [], handler, limitCount = 5) {
  if (!Array.isArray(items) || items.length === 0)
    throw new Error("bulkProcess: 'items' must be a non-empty array");
  if (typeof handler !== "function")
    throw new Error("bulkProcess: 'handler' must be a function");

  const results = [];
  let active = 0;
  let index = 0;

  return new Promise((resolve) => {
    const next = async () => {
      // When all items are processed
      if (index >= items.length && active === 0) {
        return resolve(results);
      }

      // If we still have capacity, run next job
      while (active < limitCount && index < items.length) {
        const item = items[index++];
        active++;

        handler(item)
          .then((res) => {
            results.push({ id: item, status: "success", result: res });
          })
          .catch((err) => {
            console.error(
              `[QBO][BulkProcess] Failed for ${item}:`,
              err.message
            );
            results.push({ id: item, status: "failed", error: err.message });
          })
          .finally(() => {
            active--;
            next(); // Start the next job
          });
      }
    };

    next();
  });
}
