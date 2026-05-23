const { order, partnerOrder } = require("../models");
const { orderEvents } = require("../controllers/events/orderEvents");
const {
  paidInvoiceAdminOrLocalPatnerEventAndCustomer,
} = require("../controllers/events/paymentInvoicePaidEvent");
const {
  sentPaymentInvoiceEvent,
} = require("../controllers/events/sentPaymentInvoiceEvent");
const { orderShippedEvent } = require("../controllers/events/orderShippedEvent");
const { orderDispatchEvent } = require("../controllers/events/orderDispatchEvent");
const { supplierNewOrderEvent } = require("../controllers/events/orderToSupplierEvents");

const VALID_EMAIL_TYPES = [
  "order-confirmation",
  "paid-invoice",
  "invoice-sent",
  "invoice-reminder",
  "order-dispatch",
  "order-shipped",
  "order-ship-supplier",
];

const DIRECT_INVOICE_ALLOWED_TYPES = ["invoice-sent", "invoice-reminder"];

/**
 * Dispatch one order email (same behavior as emailHelper).
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function dispatchOrderEmail({ orderId, orderType, emailType }) {
  const numericOrderId = Number(orderId);
  const normalizedOrderType =
    orderType === "local-partner" ? "local-partner" : "customer";

  if (!numericOrderId || Number.isNaN(numericOrderId)) {
    return { success: false, error: "Invalid orderId" };
  }
  if (!emailType || !VALID_EMAIL_TYPES.includes(emailType)) {
    return {
      success: false,
      error: `Invalid emailType. Allowed: ${VALID_EMAIL_TYPES.join(", ")}`,
    };
  }

  const model = normalizedOrderType === "local-partner" ? partnerOrder : order;
  const orderData = await model.findOne({
    where: { id: numericOrderId },
    attributes: ["id", "type", "invoiceDate"],
  });

  if (!orderData) {
    return { success: false, error: "Order not found" };
  }

  if (orderData.type === "direct-invoice") {
    if (!DIRECT_INVOICE_ALLOWED_TYPES.includes(emailType)) {
      return {
        success: false,
        error:
          "Direct invoice orders only support invoice-sent and invoice-reminder.",
      };
    }
  }

  if (emailType === "order-confirmation") {
    orderEvents({ orderId: numericOrderId, orderType: normalizedOrderType });
  } else if (emailType === "paid-invoice") {
    paidInvoiceAdminOrLocalPatnerEventAndCustomer({
      orderId: numericOrderId,
      orderType: normalizedOrderType,
    });
  } else if (emailType === "invoice-sent" || emailType === "invoice-reminder") {
    const input = {};
    if (!orderData.invoiceDate) input.invoiceDate = new Date();
    if (orderData.invoiceDate) input.invoiceReminder = new Date();
    await model.update(input, { where: { id: numericOrderId } });
    sentPaymentInvoiceEvent({
      orderId: numericOrderId,
      orderType: normalizedOrderType,
    });
  } else if (emailType === "order-dispatch") {
    orderDispatchEvent({
      orderId: numericOrderId,
      orderType: normalizedOrderType,
    });
  } else if (emailType === "order-shipped") {
    orderShippedEvent({
      orderId: numericOrderId,
      orderType: normalizedOrderType,
    });
  } else if (emailType === "order-ship-supplier") {
    supplierNewOrderEvent({
      orderId: numericOrderId,
      orderType: normalizedOrderType,
    });
  }

  return { success: true };
}

module.exports = {
  dispatchOrderEmail,
  VALID_EMAIL_TYPES,
  DIRECT_INVOICE_ALLOWED_TYPES,
};
