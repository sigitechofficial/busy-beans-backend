const sentInvoiceEmail = require('../../helper/sentInvoiceEmail');

exports.sentPaymentInvoiceEvent = async ({ email, data, invoice }) => {
  try {
    sentInvoiceEmail({ email: email, data: data, invoice: invoice });
    console.log('🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀');
    return true;
  } catch (error) {
    console.log('🚀 ~ exports.sendQuotation = ~ error:', error);
  }
};
