const sendMultiInvoicePaidEmail = require("../../helper/paidMultiInvoiceEmail");
const {
  dataForMultiInvoiceEmail,
} = require("../../utils/dataForMultiInvoiceEmail");
const {
  sendIfAllowed,
  orderPerson,
  partnerOrHq,
} = require("../../utils/emailSendGate");

exports.multiInvoicePaidEvent = async ({ checkoutBatchId }) => {
  try {
    const payload = await dataForMultiInvoiceEmail(checkoutBatchId);
    if (!payload) return false;

    const { orders, email, adminEmail, grandTotal } = payload;
    const details = orders[0] || {};
    const orderId = details.id;
    const orderType = "customer";

    let to = [];
    if (email) to.push(email);

    const extra = orders[0]?.emailToSendInvoices;
    if (extra && email !== extra) {
      to = to.concat(extra.split(/\s*,\s*/).filter(Boolean));
    }
    to = [...new Set(to)];

    try {
      await sendIfAllowed({
        ...partnerOrHq(details),
        emailType: "paid_receipt_admin",
        orderId,
        orderType,
        recipients: adminEmail,
        send: async () => {
          await sendMultiInvoicePaidEmail({
            to: adminEmail,
            orders,
            grandTotal,
            checkoutBatchId,
            isAdminCopy: true,
          });
        },
      });
    } catch (adminErr) {
      console.error(
        "[MULTI-INVOICE-PAID-EVENT] Admin email failed:",
        adminErr?.message || adminErr,
      );
    }

    try {
      await sendIfAllowed({
        ...orderPerson(details, orderType),
        emailType: "paid_receipt",
        orderId,
        orderType,
        recipients: to,
        send: async () => {
          await sendMultiInvoicePaidEmail({
            to,
            orders,
            grandTotal,
            checkoutBatchId,
            isAdminCopy: false,
          });
        },
      });
    } catch (customerErr) {
      console.error(
        "[MULTI-INVOICE-PAID-EVENT] Customer email failed:",
        customerErr?.message || customerErr,
      );
    }

    return true;
  } catch (error) {
    console.error("[MULTI-INVOICE-PAID-EVENT] Error:", error);
    return false;
  }
};
