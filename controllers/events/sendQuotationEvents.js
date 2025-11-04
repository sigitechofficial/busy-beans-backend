const sendQuotation = require('../../helper/sendQuotation');

exports.sendQuotationEvent = async ({ email, data, localPatner }) => {
  try {
    sendQuotation({ email: email, data: data, localPatner: localPatner });
    console.log('🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀');
    return true;
  } catch (error) {
    console.log('🚀 ~ exports.sendQuotation = ~ error:', error);
  }
};
