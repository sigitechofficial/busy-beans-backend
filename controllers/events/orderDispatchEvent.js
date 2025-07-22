const orderDispatch = require('../../helper/orderDispatch');
const {
  dataForEmailAndNotifications,
} = require('../../utils/emailsNotificationsData');

exports.orderDispatchEvent = async ({ orderId }) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId);
    if (!orderData) return false;
    const { details } = orderData;
    orderDispatch({ email: details?.email, data: details });
    console.log('🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀');
    return true;
  } catch (error) {
    console.log('🚀 ~ exports.sendQuotation = ~ error:', error);
  }
};
