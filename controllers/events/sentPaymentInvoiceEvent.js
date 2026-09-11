const sentInvoiceEmail = require("../../helper/sentInvoiceEmail");
const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");
const { order, partnerOrder } = require("../../models");
const {
  sendIfAllowed,
  orderPerson,
} = require("../../utils/emailSendGate");

exports.sentPaymentInvoiceEvent = async ({
  orderId,
  orderType = "customer",
}) => {
  try {
    const { details, email } = await dataForEmailAndNotifications(
      orderId,
      orderType,
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
          : [];
        to = to.concat(emailArray);
      }
    }

    to = [...new Set(to)];
    const person = orderPerson(details, orderType);
    const emailType = details?.invoiceReminder
      ? "invoice_reminder"
      : "invoice_sent";
    const sent = await sendIfAllowed({
      ...person,
      emailType,
      orderId,
      orderType,
      recipients: to,
      send: async () => {
        await sentInvoiceEmail({ email: to, data: details });
      },
    });
    if (sent) {
      const model = orderType === "local-partner" ? partnerOrder : order;
      await model.increment(
        { invoiceEmailSentCount: 1 },
        { where: { id: orderId } },
      );
    }
    return { sent };
  } catch (error) {
    console.log("🚀 ~ exports.sendQuotation = ~ error:", error);
  }
};
