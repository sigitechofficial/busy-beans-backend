// services/paymentSyncService.js

const { createQboPayment } = require("./qboInvoice");

const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { handleQboError } = require("./qboErrorHandler");

const {
  getOrderWithAssociations,
  getOrdersWithAssociations,
} = require("./orderService");

const {
  order,
  partnerOrder,
  salesRep,
  account,
  qboCustomerMap,
} = require("../models");

/* ============================================================
   ADMIN PAYMENT SYNC
============================================================ */

async function syncAdminPaymentToQBO({ ord, ADMIN, MODEL, orderType }) {
  console.log("🚀 [QBO] Admin payment sync:", ord.id);

  if (
    !ord?.adminRealmId ||
    ord?.quickBooksPaymentId ||
    !ord?.quickBooksInvoiceId ||
    ord?.paymentStatus !== "done"
  ) {
    return { skipped: true };
  }

  const adminCondition = {
    realmId: ord.adminRealmId,
    accountId: ADMIN.id,
  };

  const customerCondition =
    orderType === "customer"
      ? { ...adminCondition, userId: ord.userId }
      : { ...adminCondition, salesRepId: ord.salesRepId };

  const qboCustomer = await qboCustomerMap.findOne({
    where: customerCondition,
  });

  if (!qboCustomer?.qboCustomerId) {
    throw new Error("QBO customer not found for admin");
  }

  const { accessToken } = await refreshAccessTokenIfNeeded({
    condition: adminCondition,
  });

  if (!accessToken) {
    throw new Error("Admin QBO token missing");
  }

  // First attempt
  let result = await createQboPayment({
    accessToken,
    invoiceId: ord.quickBooksInvoiceId,
    order: ord,
    realmId: ord.adminRealmId,
    qboCustomerId: qboCustomer.qboCustomerId,
    subtractLocalPartnerCommission:
      orderType === "customer" && !!ord?.salesRepId,
  });

  // Retry with force=true (which enables allowRecovery inside
  // createPaymentForInvoice) ONLY when the first attempt was skipped because
  // the invoice is paid/closed but has no linked payment on QBO. The
  // targeted "existing-payment" pre-check runs again inside the retry, so
  // this can never produce a duplicate payment.
  if (result?.skipped && result?.reason === "paid_no_linked_payment") {
    console.warn(
      `⚠️ [QBO] Invoice ${ord.quickBooksInvoiceId} closed without linked payment. Retrying with allowRecovery...`,
    );

    result = await createQboPayment({
      accessToken,
      invoiceId: ord.quickBooksInvoiceId,
      order: ord,
      realmId: ord.adminRealmId,
      qboCustomerId: qboCustomer.qboCustomerId,
      subtractLocalPartnerCommission:
        orderType === "customer" && !!ord?.salesRepId,
      force: true,
    });
  }

  const paymentId = result?.paymentId || result?.id;

  if (!paymentId) {
    if (result?.skipped) {
      throw new Error(
        `Failed to create or recover admin payment for invoice ${ord.quickBooksInvoiceId}: ${result.reason || "skipped"} - ${result.note || ""}`,
      );
    }
    throw new Error(
      `Failed to create or recover admin payment for invoice ${ord.quickBooksInvoiceId}`,
    );
  }

  await MODEL.update(
    {
      quickBooksPaymentId: paymentId,
      paymentSyncedToQBO: true,
      qboLastSync: new Date(),
    },
    { where: { id: ord.id } },
  );

  console.log(`✅ [QBO] Admin payment saved: ${paymentId}`);

  return { success: true, paymentId };
}

/* ============================================================
   PARTNER PAYMENT SYNC
============================================================ */

async function syncPartnerPaymentToQBO({ ord, MODEL }) {
  console.log("🚀 [QBO] Partner payment sync:", ord.id);

  if (
    !ord?.partnerRealmId ||
    ord?.quickBooksPaymentIdPartner ||
    !ord?.quickBooksInvoiceIdPartner ||
    ord?.paymentStatus !== "done"
  ) {
    return { skipped: true };
  }

  const partnerCondition = {
    realmId: ord.partnerRealmId,
    salesRepId: ord.salesRepId,
  };

  const customerCondition = {
    ...partnerCondition,
    userId: ord.userId,
  };

  const qboCustomer = await qboCustomerMap.findOne({
    where: customerCondition,
  });

  if (!qboCustomer?.qboCustomerId) {
    throw new Error("QBO customer not found for partner");
  }

  const { accessToken } = await refreshAccessTokenIfNeeded({
    condition: partnerCondition,
  });

  if (!accessToken) {
    throw new Error("Partner QBO token missing");
  }

  let result = await createQboPayment({
    accessToken,
    invoiceId: ord.quickBooksInvoiceIdPartner,
    order: ord,
    realmId: ord.partnerRealmId,
    qboCustomerId: qboCustomer.qboCustomerId,
    subtractLocalPartnerCommission: false,
  });

  // Retry with force=true (allowRecovery) only for the "paid invoice with
  // no linked payment" case. The targeted pre-check inside the retry will
  // prevent duplicate creation.
  if (result?.skipped && result?.reason === "paid_no_linked_payment") {
    console.warn(
      `⚠️ [QBO] Partner invoice ${ord.quickBooksInvoiceIdPartner} closed without linked payment. Retrying with allowRecovery...`,
    );

    result = await createQboPayment({
      accessToken,
      invoiceId: ord.quickBooksInvoiceIdPartner,
      order: ord,
      realmId: ord.partnerRealmId,
      qboCustomerId: qboCustomer.qboCustomerId,
      subtractLocalPartnerCommission: false,
      force: true,
    });
  }

  const paymentId = result?.paymentId || result?.id;

  if (!paymentId) {
    if (result?.skipped) {
      throw new Error(
        `Failed to create or recover partner payment for invoice ${ord.quickBooksInvoiceIdPartner}: ${result.reason || "skipped"} - ${result.note || ""}`,
      );
    }
    throw new Error(
      `Failed to create or recover partner payment for invoice ${ord.quickBooksInvoiceIdPartner}`,
    );
  }

  await MODEL.update(
    {
      quickBooksPaymentIdPartner: paymentId,
      paymentSyncedToQBO: true,
      qboLastSync: new Date(),
    },
    { where: { id: ord.id } },
  );

  console.log(`✅ [QBO] Partner payment saved: ${paymentId}`);

  return { success: true, paymentId };
}

/* ============================================================
   SINGLE ORDER PAYMENT SYNC
============================================================ */

async function syncPaymentToQuickBooks({ orderId, orderType = "customer" }) {
  console.log("🚀 [QBO] Sync single payment:", orderId);

  try {
    const ADMIN = await account.findOne({});
    const MODEL = orderType === "customer" ? order : partnerOrder;

    const ord = await getOrderWithAssociations({ orderId, orderType });

    if (!ord) throw new Error(`Order ${orderId} not found`);

    // ADMIN
    await syncAdminPaymentToQBO({ ord, ADMIN, MODEL, orderType });

    // PARTNER
    if (orderType === "customer" && ord?.partnerRealmId) {
      await syncPartnerPaymentToQBO({ ord, MODEL });
    }

    console.log(`✅ [QBO] Payment synced: ${orderId}`);

    return { status: "success" };
  } catch (err) {
    handleQboError({
      err,
      context: `[QBO][PaymentSync] Error syncing order ${orderId}`,
    });

    throw err;
  }
}

/* ============================================================
   BULK PAYMENT SYNC
============================================================ */

async function syncMultiplePaymentsToQuickBooks({
  orderIds,
  orderType = "customer",
}) {
  console.log("🚀 [QBO] Bulk payment sync:", orderIds);

  if (!Array.isArray(orderIds) || !orderIds.length) {
    throw new Error("orderIds must be a non-empty array");
  }

  try {
    const ADMIN = await account.findOne({});
    const MODEL = orderType === "customer" ? order : partnerOrder;

    const orders = await getOrdersWithAssociations({ orderIds, orderType });

    if (!orders?.length) {
      throw new Error("No orders found");
    }

    const results = [];

    let successCount = 0;
    let failureCount = 0;

    for (const ord of orders) {
      try {
        console.log(`🔄 [QBO] Processing order ${ord.id}`);

        if (ord.paymentStatus !== "done") {
          results.push({
            orderId: ord.id,
            status: "skipped",
            message: "Payment not marked as done",
          });

          continue;
        }

        let adminResult = null;
        let partnerResult = null;

        if (
          ord.adminRealmId &&
          !ord.quickBooksPaymentId &&
          ord.quickBooksInvoiceId
        ) {
          adminResult = await syncAdminPaymentToQBO({
            ord,
            ADMIN,
            MODEL,
            orderType,
          });
        }

        if (
          orderType === "customer" &&
          ord.partnerRealmId &&
          !ord.quickBooksPaymentIdPartner &&
          ord.quickBooksInvoiceIdPartner
        ) {
          partnerResult = await syncPartnerPaymentToQBO({
            ord,
            MODEL,
          });
        }

        if (
          adminResult?.paymentId ||
          ord.quickBooksPaymentId ||
          partnerResult?.paymentId ||
          ord.quickBooksPaymentIdPartner
        ) {
          results.push({
            orderId: ord.id,
            status: "success",
            message: "Payment synced successfully",
          });

          successCount++;
        } else {
          results.push({
            orderId: ord.id,
            status: "warning",
            message: "No payment created or linked",
          });
        }
      } catch (err) {
        console.error(`❌ [QBO] Order ${ord.id} failed:`, err.message);

        results.push({
          orderId: ord.id,
          status: "failed",
          message: err.message,
        });

        failureCount++;
      }
    }

    const summary = {
      total: orders.length,
      successCount,
      failureCount,
      skippedCount: results.filter((r) => r.status === "skipped").length,
      results,
      message: `Bulk payment sync completed: ${successCount} succeeded, ${failureCount} failed out of ${orders.length}`,
    };

    console.log("📊 [QBO] Bulk summary:", summary);

    return summary;
  } catch (err) {
    handleQboError({
      err,
      context: "[QBO][BulkPaymentSync]",
    });

    throw err;
  }
}

function adminPaymentSyncSkipReason(ord) {
  if (ord.paymentStatus !== "done") return "payment_not_done";
  if (!ord.quickBooksInvoiceId || String(ord.quickBooksInvoiceId).trim() === "")
    return "no_admin_invoice";
  if (ord.quickBooksPaymentId && String(ord.quickBooksPaymentId).trim() !== "")
    return "admin_payment_already_synced";
  if (!ord.adminRealmId) return "no_admin_realm";
  return "not_eligible";
}

/**
 * Sync **admin** QBO payments only for many orders (no partner QBO).
 * Same rules as `syncAdminPaymentToQBO`: paid orders with admin invoice, no admin payment yet, adminRealmId set.
 *
 * @param {Object} opts
 * @param {number[]} opts.orderIds
 * @param {'customer'|'local-partner'} [opts.orderType='customer']
 */
async function syncAdminPaymentsForOrders({
  orderIds,
  orderType = "customer",
} = {}) {
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error("orderIds must be a non-empty array");
  }

  const numericIds = [
    ...new Set(
      orderIds.map((id) => Number(id)).filter((n) => !Number.isNaN(n) && n > 0),
    ),
  ];
  if (numericIds.length === 0) {
    throw new Error("orderIds must contain valid numeric ids");
  }

  const ADMIN = await account.findOne({});
  if (!ADMIN?.id) {
    throw new Error("Admin account not found");
  }

  const MODEL = orderType === "customer" ? order : partnerOrder;

  const orders = await getOrdersWithAssociations({
    orderIds: numericIds,
    orderType,
  });
  const foundIdSet = new Set(orders.map((o) => o.id));
  const ordersNotFound = numericIds.filter((id) => !foundIdSet.has(id));

  const synced = [];
  const failed = [];
  const skipped = [];

  for (const ord of orders) {
    try {
      const preReason = adminPaymentSyncSkipReason(ord);
      if (preReason !== "not_eligible") {
        skipped.push({ orderId: ord.id, reason: preReason });
      } else {
        const adminResult = await syncAdminPaymentToQBO({
          ord,
          ADMIN,
          MODEL,
          orderType,
        });

        if (adminResult?.skipped) {
          skipped.push({
            orderId: ord.id,
            reason: adminPaymentSyncSkipReason(ord),
          });
        } else if (adminResult?.success && adminResult?.paymentId) {
          synced.push({
            orderId: ord.id,
            paymentId: adminResult.paymentId,
          });
        } else {
          skipped.push({ orderId: ord.id, reason: "no_payment_created" });
        }
      }
    } catch (err) {
      failed.push({
        orderId: ord.id,
        message: err.message || "sync_failed",
      });
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  return {
    orderType,
    synced,
    failed,
    skipped,
    ordersNotFound,
    summary: {
      synced: synced.length,
      failed: failed.length,
      skipped: skipped.length,
      ordersNotFound: ordersNotFound.length,
      totalRequested: numericIds.length,
    },
  };
}

module.exports = {
  syncPaymentToQuickBooks,
  syncMultiplePaymentsToQuickBooks,
  syncAdminPaymentsForOrders,
};
