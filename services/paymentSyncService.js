// services/paymentSyncService.js
const {
  createPaymentForInvoice,
  mapPaymentMethodName,
} = require("./qboInvoice");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { order, user, partnerOrder, salesRep } = require("../models");
const { where } = require("sequelize");

/**
 * Sync a successful Stripe (or manual) payment to QuickBooks.
 * Trigger this when your system marks an invoice as "paid".
 */
async function syncPaymentToQuickBooks({ orderId, orederType = "customer" }) {
  console.log("🚀 ~ syncPaymentToQuickBooks ~ orderId:", orderId);
  try {
    // Fetch a valid token (auto-refresh)
    const { accessToken, realmId } = await refreshAccessTokenIfNeeded();
    if (!accessToken || !realmId)
      throw new Error("QBO not connected or token missing");

    // Get order info
    const MODEL = orederType === "customer" ? order : partnerOrder;
    const ord = await MODEL.findOne({
      where: { id: orderId },
      include: [
        {
          model: orederType == "customer" ? user : salesRep,
          attributes: ["id", "qboCustomerId", "email"],
        },
      ],
    });

    if (!ord) throw new Error(`Order ${orderId} not found`);
    if (!ord.quickBooksInvoiceId)
      throw new Error(`Order ${orderId} has no QBO invoice ID`);

    // Map payment details
    const paymentMethodName =
      mapPaymentMethodName(ord.paymentMethod) || "Credit Card";

    // Create payment in QBO
    console.log("🚀 ~ syncPaymentToQuickBooks ~ ord.salesRep:", ord?.salesRep);
    console.log("🚀 ~ syncPaymentToQuickBooks ~ ord.user:", ord?.user);

    const qboCustomerId =
      ord?.user?.qboCustomerId || ord?.salesRep?.qboCustomerId;
    console.log("🚀 ~ syncPaymentToQuickBooks ~ qboCustomerId:", qboCustomerId);
    console.log("🚀 ~ syncPaymentToQuickBooks ~ qboCustomerId:", qboCustomerId);
    console.log("🚀 ~ syncPaymentToQuickBooks ~ qboCustomerId:", qboCustomerId);
    const paymentRes = await createPaymentForInvoice({
      accessToken,
      realmId,
      invoiceId: ord.quickBooksInvoiceId,
      customerId: qboCustomerId,
      amount: ord.totalBill,
      paymentMethodName,
      refNumber: null, // ord?.paymentIntentId || ord?.invoiceId,
      paidDate: ord?.invoicePaidDate
        ? new Date(ord.invoicePaidDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    });

    // Update local DB with payment info
    console.log("🚀 ~ syncPaymentToQuickBooks ~ paymentRes:", paymentRes);
    console.log("🚀 ~ syncPaymentToQuickBooks ~ console:", console);
    if (paymentRes?.id) {
      await MODEL.update(
        {
          quickBooksPaymentId: paymentRes.id,
          paymentSyncedToQBO: true,
          qboLastSync: new Date(),
        },
        { where: { id: orderId } }
      );
    }

    console.log(`[QBO][PaymentSync] ✓ Payment synced for order ${orderId}`);
    return { status: "success", data: paymentRes };
  } catch (err) {
    console.error(
      `[QBO][PaymentSync] ✗ Error syncing order ${orderId}:`,
      err.message
    );
    throw err;
  }
}

module.exports = { syncPaymentToQuickBooks };
