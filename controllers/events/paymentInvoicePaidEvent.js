const fs = require("fs");
const path = require("path");
const paidInvoiceEmail = require("../../helper/paidInvoiceEmail");
const paidInvoiceEmailAdminOrLocalPatner = require("../../helper/paidInvoiceEmailAdminOrLocalPatner");
const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");
// exports.paidInvoiceEmailEvent = async ({ orderId }) => {
//   try {
//     const orderData = await dataForEmailAndNotifications(orderId);
//     if (!orderData) return false;
//     const { details, email } = orderData;
//     await paidInvoiceEmail({ email: email, data: details, invoice: null });
//     console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
//     return true;
//   } catch (error) {
//     console.log("🚀 ~ exports.paidInvoiceEmailEvent = ~ error:", error);
//   }
// };

// exports.paidInvoiceAdminOrLocalPatnerEvent = async ({ orderId }) => {
//   try {
//     const orderData = await dataForEmailAndNotifications(orderId);
//     if (!orderData) return false;
//     const { details, email } = orderData;
//     await paidInvoiceEmailAdminOrLocalPatner({
//       email: details?.patnerEmail || "info@busybeancoffee.com",
//       data: details,
//       invoice: null,
//     });
//     console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
//     return true;
//   } catch (error) {
//     console.log("🚀 ~ exports.sendQuotation = ~ error:", error);
//   }
// };

exports.paidInvoiceAdminOrLocalPatnerEventAndCustomer = async ({
  orderId,
  orderType = "customer",
}) => {
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
  console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");

  const pdfFilename = `invoice-00${orderId}.pdf`; // or `inv-${order.id}.pdf` if you're using dash
  const pdfPath = path.join(__dirname, "../../public/invoicePDFs", pdfFilename);
  fs.access(pdfPath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(pdfPath, (unlinkErr) => {
        if (unlinkErr) {
          console.error(
            `❌ ~ Failed to delete invoice PDF for order ${orderId}:`,
            unlinkErr,
          );
        } else {
          console.log(`🗑️ ~ Deleted invoice PDF: ${pdfFilename}`);
        }
      });
    } else {
      console.warn(
        `⚠️ ~ No invoice PDF found for order ${orderId} at ${pdfPath}`,
      );
    }
  });
  try {
    const orderData = await dataForEmailAndNotifications(orderId, orderType);
    if (!orderData) return false;
    const { details, email } = orderData;

    const adminEmail = details?.patnerEmail || "info@busybeancoffee.com";

    // Send admin/partner first, then customer (original order). Sequential to avoid PDF race.
    console.log(
      "[PAID-INVOICE-EVENT] orderId=%s orderType=%s → sending BOTH (1.admin/partner 2.customer)",
      orderId,
      orderType,
    );
    try {
      console.log(
        "[PAID-INVOICE-EVENT] (1/2) Admin/partner block START → to:",
        adminEmail,
      );
      await paidInvoiceEmailAdminOrLocalPatner({
        email: adminEmail,
        data: details,
        invoice: null,
      });
      console.log("[PAID-INVOICE-EVENT] (1/2) Admin/partner email sent OK");
    } catch (adminError) {
      console.error(
        "[PAID-INVOICE-EVENT] (1/2) Admin/partner email FAILED:",
        adminError?.message || adminError,
      );
      if (adminError?.stack)
        console.error("[PAID-INVOICE-EVENT] admin stack:", adminError.stack);
    }

    try {
      console.log(
        "[PAID-INVOICE-EVENT] (2/2) Customer block START → to:",
        email,
      );
      await paidInvoiceEmail({ email: email, data: details, invoice: null });
      console.log("[PAID-INVOICE-EVENT] (2/2) Customer email sent OK");
    } catch (customerError) {
      console.error(
        "[PAID-INVOICE-EVENT] (2/2) Customer email FAILED:",
        customerError?.message || customerError,
      );
      if (customerError?.stack)
        console.error(
          "[PAID-INVOICE-EVENT] customer stack:",
          customerError.stack,
        );
    }

    console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
    return true;
  } catch (error) {
    console.log("🚀 ~ exports.sendQuotation = ~ error:", error);
    return false;
  }
};
