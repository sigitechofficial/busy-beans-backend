// services/paymentSyncService.js
const {
  createPaymentForInvoice,
  mapPaymentMethodName,
  createQboPayment,
} = require("./qboInvoice");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { handleQboError } = require("./qboErrorHandler");
const {
  getOrderWithAssociations,
  getOrdersWithAssociations,
} = require("./orderService");
const {
  order,
  user,
  partnerOrder,
  salesRep,
  account,
  qboCustomerMap,
} = require("../models");
const { where } = require("sequelize");

/* ===================================================================
   🔹 Helper 1 — ADMIN PAYMENT SYNC
=================================================================== */

async function syncAdminPaymentToQBO({ ord, ADMIN, MODEL, orderType }) {
  console.log("🚀 ~ syncAdminPaymentToQBO ~ syncAdminPaymentToQBO:");
  if (
    !ord?.adminRealmId ||
    ord?.quickBooksPaymentId ||
    !ord?.quickBooksInvoiceId ||
    ord?.paymentStatus !== "done"
  ) {
    return; // Nothing to do
  }

  const adminQboCondition = {
    realmId: ord.adminRealmId,
    accountId: ADMIN.id,
  };

  const customerOrPartnerCondition =
    orderType === "customer"
      ? { ...adminQboCondition, userId: ord.userId }
      : { ...adminQboCondition, salesRepId: ord.salesRepId };

  const qboCustomerOnAdmin = await qboCustomerMap.findOne({
    where: customerOrPartnerCondition,
  });

  if (!qboCustomerOnAdmin?.qboCustomerId) {
    console.log("🚀 ~ syncAdminPaymentToQBO ~ ADMIN QBO CUSTOMER NOT FOUND");
    return;
  }

  ord.qboCustomerId = qboCustomerOnAdmin.qboCustomerId;

  const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
    condition: adminQboCondition,
  });

  if (!accessToken || !realmId) {
    console.log(
      "🚀 ~ syncAdminPaymentToQBO ~ QBO CONNECTION REQUIRED FOR ADMIN"
    );
    return false;
  }

  const paymentResult = await createQboPayment({
    accessToken,
    invoiceId: ord.quickBooksInvoiceId,
    order: ord,
    realmId: ord.adminRealmId,
    qboCustomerId: qboCustomerOnAdmin?.qboCustomerId,
  });

  const paymentId = paymentResult?.paymentId;

  // Only update DB if we have a payment ID (either newly created or found existing)
  if (paymentId) {
    await MODEL.update(
      {
        quickBooksPaymentId: paymentId,
        paymentSyncedToQBO: true,
      },
      { where: { id: ord.id } }
    );
    console.log(
      `✅ [QBO] Updated order ${ord.id} with payment ID: ${paymentId}`
    );
  } else if (paymentResult?.skipped) {
    // Payment was skipped (invoice already paid but payment not found)
    // Don't update DB and don't throw error - just log
    console.log(
      `ℹ️ [QBO] Payment sync skipped for order ${ord.id} - invoice already paid but payment not found in QBO`
    );
  } else {
    // This shouldn't happen, but if paymentId is null and not skipped, log warning
    console.warn(
      `⚠️ [QBO] No payment ID returned for order ${ord.id} - payment may have failed`
    );
  }
}

/* ===================================================================
   🔹 Helper 2 — PARTNER PAYMENT SYNC
=================================================================== */

async function syncPartnerPaymentToQBO({ ord, MODEL }) {
  console.log("🚀 ~ syncPartnerPaymentToQBO ~ syncPartnerPaymentToQBO:");
  if (
    !ord?.partnerRealmId ||
    ord?.quickBooksPaymentIdPartner ||
    !ord?.quickBooksInvoiceIdPartner ||
    ord?.paymentStatus !== "done"
  ) {
    return; // Nothing to do
  }

  const partnerQboCondition = {
    realmId: ord.partnerRealmId,
    salesRepId: ord.salesRepId,
  };

  const customerCondition = {
    ...partnerQboCondition,
    userId: ord.userId,
  };

  const qboCustomerOnPartner = await qboCustomerMap.findOne({
    where: customerCondition,
  });

  if (!qboCustomerOnPartner?.qboCustomerId) {
    console.log(
      "🚀 ~ syncPartnerPaymentToQBO ~ PARTNER QBO CUSTOMER NOT FOUND"
    );
    return;
  }

  ord.qboCustomerId = qboCustomerOnPartner.qboCustomerId;

  const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
    condition: partnerQboCondition,
  });

  if (!accessToken || !realmId) {
    console.log(
      "🚀 ~ syncPartnerPaymentToQBO ~ QBO CONNECTION REQUIRED FOR PARTNER"
    );
    return;
  }

  const paymentResult = await createQboPayment({
    accessToken,
    invoiceId: ord.quickBooksInvoiceIdPartner,
    order: ord,
    realmId: ord.partnerRealmId,
    qboCustomerId: qboCustomerOnPartner?.qboCustomerId,
  });

  const paymentId = paymentResult?.paymentId;

  // Only update DB if we have a payment ID (either newly created or found existing)
  if (paymentId) {
    await MODEL.update(
      {
        quickBooksPaymentIdPartner: paymentId,
        paymentSyncedToQBO: true,
      },
      { where: { id: ord.id } }
    );
    console.log(
      `✅ [QBO] Updated order ${ord.id} with partner payment ID: ${paymentId}`
    );
  } else if (paymentResult?.skipped) {
    // Payment was skipped (invoice already paid but payment not found)
    // Don't update DB and don't throw error - just log
    console.log(
      `ℹ️ [QBO] Partner payment sync skipped for order ${ord.id} - invoice already paid but payment not found in QBO`
    );
  } else {
    // This shouldn't happen, but if paymentId is null and not skipped, log warning
    console.warn(
      `⚠️ [QBO] No partner payment ID returned for order ${ord.id} - payment may have failed`
    );
  }
}

/**
 * Sync a successful Stripe (or manual) payment to QuickBooks.
 * Trigger this when your system marks an invoice as "paid".
 */
async function syncPaymentToQuickBooks({ orderId, orderType = "customer" }) {
  console.log("🚀 ~ syncPaymentToQuickBooks ~ orderType:", orderType);
  console.log("🚀 ~ syncPaymentToQuickBooks ~ orderId:", orderId);

  try {
    const ADMIN = await account.findOne({});
    const MODEL = orderType === "customer" ? order : partnerOrder;

    // Fetch order with associations
    const ord = await getOrderWithAssociations({ orderId, orderType });
    if (!ord) throw new Error(`Order ${orderId} not found`);

    // 1) ADMIN PAYMENT SYNC
    syncAdminPaymentToQBO({ ord, ADMIN, MODEL, orderType });

    // 2) PARTNER PAYMENT SYNC (only for customer orders)
    if (orderType === "customer" && ord?.partnerRealmId) {
      syncPartnerPaymentToQBO({ ord, MODEL });
    }

    console.log(
      `[QBO][PaymentSync] ✓ Payment sync completed for order ${orderId}`
    );

    return { status: "success", data: {} };
  } catch (err) {
    handleQboError({
      err,
      context: `[QBO][PaymentSync] ✗ Error syncing order ${orderId}:`,
    });
  }
}

/**
 * Sync multiple order payments to QuickBooks in bulk
 * @param {Array<number>} orderIds - Array of order IDs to sync payments for
 * @param {string} orderType - Type of orders: "customer" or "local-partner"
 * @returns {Object} Summary with success/failure counts and detailed results
 */
async function syncMultiplePaymentsToQuickBooks({
  orderIds,
  orderType = "customer",
}) {
  console.log("🚀 ~ syncMultiplePaymentsToQuickBooks ~ orderIds:", orderIds);
  console.log("🚀 ~ syncMultiplePaymentsToQuickBooks ~ orderType:", orderType);

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error("orderIds must be a non-empty array");
  }

  try {
    const ADMIN = await account.findOne({});
    const MODEL = orderType === "customer" ? order : partnerOrder;

    // Fetch all orders at once
    const orders = await getOrdersWithAssociations({ orderIds, orderType });

    if (!orders || orders.length === 0) {
      throw new Error(`No orders found for the provided IDs`);
    }

    console.log(`🚀 ~ Processing ${orders.length} orders for payment sync`);

    // Initialize results tracking
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Loop through each order and process
    for (const ord of orders) {
      try {
        console.log(`\n🔄 Processing Payment for Order #${ord.id}...`);

        // Check if payment sync is needed
        if (ord.paymentStatus !== "done") {
          results.push({
            orderId: ord.id,
            status: "skipped",
            message: `Order #${ord.id} payment status is not 'done' (current: ${ord.paymentStatus})`,
          });
          continue;
        }

        // Track if any sync happened
        let syncOccurred = false;

        // 1) ADMIN PAYMENT SYNC
        if (
          ord.adminRealmId &&
          !ord.quickBooksPaymentId &&
          ord.quickBooksInvoiceId
        ) {
          await syncAdminPaymentToQBO({ ord, ADMIN, MODEL, orderType });
          syncOccurred = true;
          console.log(`✅ Admin payment synced for Order #${ord.id}`);
        }

        // 2) PARTNER PAYMENT SYNC (only for customer orders)
        if (
          orderType === "customer" &&
          ord.partnerRealmId &&
          !ord.quickBooksPaymentIdPartner &&
          ord.quickBooksInvoiceIdPartner
        ) {
          await syncPartnerPaymentToQBO({ ord, MODEL });
          syncOccurred = true;
          console.log(`✅ Partner payment synced for Order #${ord.id}`);
        }

        if (syncOccurred) {
          results.push({
            orderId: ord.id,
            status: "success",
            message: `Payment sync successful for order #${ord.id}`,
          });
          successCount++;
        } else {
          results.push({
            orderId: ord.id,
            status: "skipped",
            message: `Order #${ord.id} already synced or missing required data`,
          });
        }

        console.log(`✅ Order #${ord.id} payment processed successfully`);
      } catch (error) {
        // Failure - log error but continue processing other orders
        console.error(
          `❌ Order #${ord.id} payment sync failed:`,
          error.message
        );
        results.push({
          orderId: ord.id,
          status: "failed",
          message: `Failed to sync payment for order #${ord.id}`,
          error: error.message,
        });
        failureCount++;
      }
    }

    // Return summary
    const summary = {
      total: orders.length,
      successCount,
      failureCount,
      skippedCount: results.filter((r) => r.status === "skipped").length,
      results,
      message: `Bulk payment sync completed: ${successCount} succeeded, ${failureCount} failed out of ${orders.length} total orders`,
    };

    console.log("\n📊 Bulk Payment Sync Summary:", summary);
    return summary;
  } catch (err) {
    handleQboError({
      err,
      context: `[QBO][BulkPaymentSync] Error in bulk payment sync:`,
    });
    throw err;
  }
}

module.exports = {
  syncPaymentToQuickBooks,
  syncMultiplePaymentsToQuickBooks,
};
// async function syncPaymentToQuickBooks({ orderId, orderType = "customer" }) {
//   console.log("🚀 ~ syncPaymentToQuickBooks ~ orderType:", orderType);
//   console.log("🚀 ~ syncPaymentToQuickBooks ~ orderId:", orderId);
//   try {
//     // Fetch a valid token (auto-refresh)
//     const { accessToken, realmId } = await refreshAccessTokenIfNeeded();
//     if (!accessToken || !realmId)
//       throw new Error("QBO not connected or token missing");

//     // Get order info
//     const MODEL = orderType === "customer" ? order : partnerOrder;
//     const ord = await getOrderWithAssociations({ orderId, orderType });

//     if (!ord) throw new Error(`Order ${orderId} not found`);
//     if (!ord.quickBooksInvoiceId)
//       throw new Error(`Order ${orderId} has no QBO invoice ID`);

//     // Map payment details
//     const paymentMethodName =
//       mapPaymentMethodName(ord.paymentMethod) || "Credit Card";

//     // Create payment in QBO
//     console.log("🚀 ~ syncPaymentToQuickBooks ~ ord.salesRep:", ord?.salesRep);
//     console.log("🚀 ~ syncPaymentToQuickBooks ~ ord.user:", ord?.user);

//     const qboCustomerId =
//       ord?.user?.qboCustomerId || ord?.salesRep?.qboCustomerId;
//     console.log("🚀 ~ syncPaymentToQuickBooks ~ qboCustomerId:", qboCustomerId);
//     console.log("🚀 ~ syncPaymentToQuickBooks ~ qboCustomerId:", qboCustomerId);
//     console.log("🚀 ~ syncPaymentToQuickBooks ~ qboCustomerId:", qboCustomerId);
//     const paymentRes = await createPaymentForInvoice({
//       accessToken,
//       realmId,
//       invoiceId: ord.quickBooksInvoiceId,
//       customerId: qboCustomerId,
//       amount: ord.totalBill,
//       paymentMethodName,
//       refNumber: null, // ord?.paymentIntentId || ord?.invoiceId,
//       paidDate: ord?.invoicePaidDate
//         ? new Date(ord.invoicePaidDate).toISOString().slice(0, 10)
//         : new Date().toISOString().slice(0, 10),
//       invoiceNumber: ord?.invoiceNumber,
//     });

//     // Update local DB with payment info
//     console.log("🚀 ~ syncPaymentToQuickBooks ~ paymentRes:", paymentRes);
//     console.log("🚀 ~ syncPaymentToQuickBooks ~ console:", console);
//     if (paymentRes?.id) {
//       await MODEL.update(
//         {
//           quickBooksPaymentId: paymentRes.id,
//           paymentSyncedToQBO: true,
//           qboLastSync: new Date(),
//         },
//         { where: { id: orderId } }
//       );
//     }

//     console.log(`[QBO][PaymentSync] ✓ Payment synced for order ${orderId}`);
//     return { status: "success", data: paymentRes };
//   } catch (err) {
//     console.error(
//       `[QBO][PaymentSync] ✗ Error syncing order ${orderId}:`,
//       err.message
//     );
//     throw err;
//   }
// }
