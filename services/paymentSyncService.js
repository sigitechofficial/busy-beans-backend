// services/paymentSyncService.js
const {
  createPaymentForInvoice,
  mapPaymentMethodName,
  createQboPayment,
} = require("./qboInvoice");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { handleQboError } = require("./qboErrorHandler");
const { getOrderWithAssociations } = require("./orderService");
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

  const { paymentId } = await createQboPayment({
    accessToken,
    invoiceId: ord.quickBooksInvoiceId,
    order: ord,
    realmId: ord.adminRealmId,
    qboCustomerId: qboCustomerOnAdmin?.qboCustomerId,
  });

  await MODEL.update(
    {
      quickBooksPaymentId: paymentId,
      paymentSyncedToQBO: true,
    },
    { where: { id: ord.id } }
  );
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

  const { paymentId } = await createQboPayment({
    accessToken,
    invoiceId: ord.quickBooksInvoiceIdPartner,
    order: ord,
    realmId: ord.partnerRealmId,
    qboCustomerId: qboCustomerOnPartner?.qboCustomerId,
  });

  await MODEL.update(
    {
      quickBooksPaymentIdPartner: paymentId,
      paymentSyncedToQBO: true,
    },
    { where: { id: ord.id } }
  );
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

module.exports = { syncPaymentToQuickBooks };
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
