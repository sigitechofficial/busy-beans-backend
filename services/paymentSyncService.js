// services/paymentSyncService.js

const {
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
  });


  // Retry if skipped
  if (result?.skipped) {

    console.warn(
      `⚠️ [QBO] Invoice ${ord.quickBooksInvoiceId} closed without payment. Retrying...`
    );

    result = await createQboPayment({
      accessToken,
      invoiceId: ord.quickBooksInvoiceId,
      order: ord,
      realmId: ord.adminRealmId,
      qboCustomerId: qboCustomer.qboCustomerId,
      force: true,
    });
  }


  const paymentId = result?.paymentId || result?.id;

  if (!paymentId) {
    throw new Error("Failed to create or recover admin payment");
  }


  await MODEL.update(
    {
      quickBooksPaymentId: paymentId,
      paymentSyncedToQBO: true,
      qboLastSync: new Date(),
    },
    { where: { id: ord.id } }
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
  });


  if (result?.skipped) {

    console.warn(
      `⚠️ [QBO] Partner invoice ${ord.quickBooksInvoiceIdPartner} closed. Retrying...`
    );

    result = await createQboPayment({
      accessToken,
      invoiceId: ord.quickBooksInvoiceIdPartner,
      order: ord,
      realmId: ord.partnerRealmId,
      qboCustomerId: qboCustomer.qboCustomerId,
      force: true,
    });
  }


  const paymentId = result?.paymentId || result?.id;

  if (!paymentId) {
    throw new Error("Failed to create or recover partner payment");
  }


  await MODEL.update(
    {
      quickBooksPaymentIdPartner: paymentId,
      paymentSyncedToQBO: true,
      qboLastSync: new Date(),
    },
    { where: { id: ord.id } }
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
          (adminResult?.paymentId || ord.quickBooksPaymentId) ||
          (partnerResult?.paymentId || ord.quickBooksPaymentIdPartner)
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
      skippedCount: results.filter(r => r.status === "skipped").length,
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


module.exports = {
  syncPaymentToQuickBooks,
  syncMultiplePaymentsToQuickBooks,
};
