const {
  dataForEmailAndNotifications,
} = require("./emailsNotificationsData");
const { getBatchWithOrders } = require("../services/multiInvoiceCheckoutService");

/**
 * Load checkout batch and per-order email payloads for multi-invoice paid email.
 */
async function dataForMultiInvoiceEmail(checkoutBatchId) {
  const batch = await getBatchWithOrders(checkoutBatchId);
  if (!batch) return null;

  const orderPayloads = [];
  let primaryEmail = null;
  let adminEmail = null;

  for (const line of batch.batchOrders || []) {
    const numericOrderId = Number(line.orderId);
    if (!numericOrderId) continue;

    const orderData = await dataForEmailAndNotifications(
      numericOrderId,
      "customer",
    );
    if (!orderData) continue;

    const { details, email } = orderData;
    orderPayloads.push({
      ...details,
      lineAmount: parseFloat(line.lineAmount || details.totalBill || 0),
    });

    if (!primaryEmail && email) primaryEmail = email;
    if (!adminEmail && details?.patnerEmail) {
      adminEmail = details.patnerEmail;
    }
  }

  if (!orderPayloads.length) return null;

  return {
    batch,
    orders: orderPayloads,
    email: primaryEmail,
    adminEmail: adminEmail || "info@busybeancoffee.com",
    grandTotal: parseFloat(batch.grandTotal || 0),
  };
}

module.exports = {
  dataForMultiInvoiceEmail,
};
