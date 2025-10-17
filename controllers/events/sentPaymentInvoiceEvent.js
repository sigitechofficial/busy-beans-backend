const sentInvoiceEmail = require("../../helper/sentInvoiceEmail");
const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");

exports.sentPaymentInvoiceEvent = async ({
  orderId,
  ordeType = "customer",
}) => {
  try {
    const { details, email } = await dataForEmailAndNotifications(
      orderId,
      ordeType
    );

    console.log(
      "🚀 ~ details?.emailToSendInvoices: before",
      details?.emailToSendInvoices
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
    sentInvoiceEmail({ email: to, data: details });
    console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
    return true;
  } catch (error) {
    console.log("🚀 ~ exports.sendQuotation = ~ error:", error);
  }
};
