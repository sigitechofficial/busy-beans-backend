const sentInvoiceEmail = require('../../helper/sentInvoiceEmail');
const {
  dataForEmailAndNotifications,
} = require('../../utils/emailsNotificationsData');

exports.sentPaymentInvoiceEvent = async ({ orderId }) => {
  try {
    const { details, email } = await dataForEmailAndNotifications(orderId);

    let to = [];
    to.push(email);
    if (email) {
      if (
        details?.emailToSendInvoices &&
        email != details?.emailToSendInvoices
      ) {
        to.push(details?.emailToSendInvoices);
      }
    }
    console.log('🚀 ~ to:', JSON.stringify(to));

    sentInvoiceEmail({ email: to, data: details });
    console.log('🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀');
    return true;
  } catch (error) {
    console.log('🚀 ~ exports.sendQuotation = ~ error:', error);
  }
};
