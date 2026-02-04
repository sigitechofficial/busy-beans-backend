const fs = require("fs");
const path = require("path");
const paidInvoiceEmail = require("../../helper/paidInvoiceEmail");
const paidInvoiceEmailAdminOrLocalPatner = require("../../helper/paidInvoiceEmailAdminOrLocalPatner");
const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");
exports.paidInvoiceEmailEvent = async ({ orderId }) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId);
    if (!orderData) return false;
    const { details, email } = orderData;
    await paidInvoiceEmail({ email: email, data: details, invoice: null });
    console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
    return true;
  } catch (error) {
    console.log("🚀 ~ exports.paidInvoiceEmailEvent = ~ error:", error);
  }
};

exports.paidInvoiceAdminOrLocalPatnerEvent = async ({ orderId }) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId);
    if (!orderData) return false;
    const { details, email } = orderData;
    await paidInvoiceEmailAdminOrLocalPatner({
      email: details?.patnerEmail || "info@busybeancoffee.com",
      data: details,
      invoice: null,
    });
    console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
    return true;
  } catch (error) {
    console.log("🚀 ~ exports.sendQuotation = ~ error:", error);
  }
};

exports.paidInvoiceAdminOrLocalPatnerEventAndCustomer = async ({
  orderId,
  orderType = "customer",
}) => {
  const pdfFilename = `invoice-00${orderId}.pdf`; // or `inv-${order.id}.pdf` if you're using dash
  const pdfPath = path.join(__dirname, "../../public/invoicePDFs", pdfFilename);
  fs.access(pdfPath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(pdfPath, (unlinkErr) => {
        if (unlinkErr) {
          console.error(
            `❌ ~ Failed to delete invoice PDF for order ${orderId}:`,
            unlinkErr
          );
        } else {
          console.log(`🗑️ ~ Deleted invoice PDF: ${pdfFilename}`);
        }
      });
    } else {
      console.warn(
        `⚠️ ~ No invoice PDF found for order ${orderId} at ${pdfPath}`
      );
    }
  });
  try {
    const orderData = await dataForEmailAndNotifications(orderId, orderType);
    if (!orderData) return false;
    const { details, email } = orderData;
    await paidInvoiceEmailAdminOrLocalPatner({
      email: details?.patnerEmail || "info@busybeancoffee.com",
      data: details,
      invoice: null,
    });
    await paidInvoiceEmail({ email: email, data: details, invoice: null });
    console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
    return true;
  } catch (error) {
    console.log("🚀 ~ exports.sendQuotation = ~ error:", error);
  }
};
