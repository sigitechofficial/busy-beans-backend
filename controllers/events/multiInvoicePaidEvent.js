const sendMultiInvoicePaidEmail = require("../../helper/paidMultiInvoiceEmail");
const {
  dataForMultiInvoiceEmail,
} = require("../../utils/dataForMultiInvoiceEmail");

exports.multiInvoicePaidEvent = async ({ checkoutBatchId }) => {
  try {
    const payload = await dataForMultiInvoiceEmail(checkoutBatchId);
    if (!payload) return false;

    const { batch, orders, email, adminEmail, grandTotal } = payload;

    let to = [];
    if (email) to.push(email);

    const extra = orders[0]?.emailToSendInvoices;
    if (extra && email !== extra) {
      to = to.concat(
        extra.split(/\s*,\s*/).filter(Boolean),
      );
    }
    to = [...new Set(to)];

    try {
      await sendMultiInvoicePaidEmail({
        to: adminEmail,
        orders,
        grandTotal,
        checkoutBatchId,
        isAdminCopy: true,
      });
    } catch (adminErr) {
      console.error(
        "[MULTI-INVOICE-PAID-EVENT] Admin email failed:",
        adminErr?.message || adminErr,
      );
    }

    try {
      await sendMultiInvoicePaidEmail({
        to,
        orders,
        grandTotal,
        checkoutBatchId,
        isAdminCopy: false,
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
