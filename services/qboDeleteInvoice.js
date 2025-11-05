// services/qboOrderService.js
const { order, item, address, user } = require("../models");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const axios = require("axios");
const { QBO, MINOR, headers } = require("./qboHelpers");

async function quickBooksInvocieDelete({ orderId }) {
  if (!orderId) throw new Error("Missing orderId");

  // 🔹 Fetch the order first
  const ord = await order.findOne({
    where: { id: orderId },
    include: [{ model: user }, { model: address }, { model: item }],
  });

  if (!ord) throw new Error(`Order ${orderId} not found`);

  // 🔹 If it was synced with QuickBooks, delete invoice from QBO first
  if (ord.quickBooksInvoiceId) {
    try {
      const { accessToken, realmId } = await refreshAccessTokenIfNeeded();

      if (!accessToken || !realmId)
        throw new Error("QBO credentials missing or disconnected");

      const deleteUrl = `${QBO(realmId)}/invoice?operation=delete&minorversion=${MINOR}`;
      const payload = { Id: String(ord.quickBooksInvoiceId), SyncToken: "0" };

      await axios.post(deleteUrl, payload, {
        headers: {
          ...headers(accessToken),
          "Content-Type": "application/json",
        },
      });

      console.log(
        `[QBO][DeleteOrder] Deleted invoice ${ord.quickBooksInvoiceId}`
      );
    } catch (err) {
      console.error(
        `[QBO][DeleteOrder] Failed to delete invoice ${ord.quickBooksInvoiceId}:`,
        err.response?.data || err.message
      );
    }
  }

  // 🔹 Delete items, address (if needed), and order locally
  await item.destroy({ where: { orderId: ord.id } });
  await order.destroy({ where: { id: ord.id } });

  console.log(`[OrderService] Local order ${orderId} deleted.`);
  return {
    status: "success",
    message: `Order ${orderId} deleted successfully.`,
    quickBooksInvoiceId: ord.quickBooksInvoiceId || null,
  };
}

module.exports = { quickBooksInvocieDelete };
