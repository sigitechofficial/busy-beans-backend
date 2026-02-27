const sentInvoiceEmail = require("../../helper/sentInvoiceEmail");
const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");
const { order, partnerOrder } = require("../../models");

exports.sentPaymentInvoiceEvent = async ({
  orderId,
  orderType = "customer",
}) => {
  console.log("🚀 ~ orderId:", orderId);
  console.log("🚀 ~ ordeType:", orderType);
  try {
    const { details, email } = await dataForEmailAndNotifications(
      orderId,
      orderType,
    );

    console.log(
      "🚀 ~ details?.emailToSendInvoices: before",
      details?.emailToSendInvoices,
    );
    let to = [];
    to.push(email);
    if (email) {
      if (
        details?.emailToSendInvoices &&
        email != details?.emailToSendInvoices
      ) {
        const emailArray = details?.emailToSendInvoices
          ? details?.emailToSendInvoices.split(/\s*,\s*/)
          : []; // This will split by commas with or without spaces
        to = to.concat(emailArray);
        // to.push(details?.emailToSendInvoices);
      }
    }

    to = [...new Set(to)];
    console.log("🚀 ~ to:", JSON.stringify(to));
    await sentInvoiceEmail({ email: to, data: details });
    const model = orderType === "local-partner" ? partnerOrder : order;
    await model.increment({ invoiceEmailSentCount: 1 }, { where: { id: orderId } });
    console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
    return true;
  } catch (error) {
    console.log("🚀 ~ exports.sendQuotation = ~ error:", error);
  }
};
