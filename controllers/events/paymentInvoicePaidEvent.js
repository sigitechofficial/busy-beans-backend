const fs = require("fs");
const path = require("path");
const paidInvoiceEmail = require("../../helper/paidInvoiceEmail");
const paidInvoiceEmailAdminOrLocalPatner = require("../../helper/paidInvoiceEmailAdminOrLocalPatner");
const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");
const {
  sendIfAllowed,
  orderPerson,
  partnerOrHq,
} = require("../../utils/emailSendGate");
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
    const partnerPerson = partnerOrHq(details);
    const customerPerson = orderPerson(details, orderType);

    let adminSent = false;
    let customerSent = false;
    try {
      adminSent = await sendIfAllowed({
        ...partnerPerson,
        emailType: "paid_receipt_admin",
        orderId,
        orderType,
        recipients: adminEmail,
        send: async () => {
          await paidInvoiceEmailAdminOrLocalPatner({
            email: adminEmail,
            data: details,
            invoice: null,
          });
        },
      });
    } catch (adminError) {
      console.error(
        "[PAID-INVOICE-EVENT] (1/2) Admin/partner email FAILED:",
        adminError?.message || adminError,
      );
    }

    try {
      customerSent = await sendIfAllowed({
        ...customerPerson,
        emailType: "paid_receipt",
        orderId,
        orderType,
        recipients: email,
        send: async () => {
          await paidInvoiceEmail({ email: email, data: details, invoice: null });
        },
      });
    } catch (customerError) {
      console.error(
        "[PAID-INVOICE-EVENT] (2/2) Customer email FAILED:",
        customerError?.message || customerError,
      );
    }

    console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
    return { sent: Boolean(adminSent || customerSent) };
  } catch (error) {
    console.log("🚀 ~ exports.sendQuotation = ~ error:", error);
    return false;
  }
};
