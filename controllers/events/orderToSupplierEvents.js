const supplierNewOrder = require('../../helper/supplierNewOrder');
const {
  dataForEmailAndNotifications,
} = require('../../utils/emailsNotificationsData');
const ThrowNotification = require('../../utils/throwNotification');


exports.supplierNewOrderEvent = async ({ orderId }) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId);
    if (!orderData) return false;
    const { details } = orderData;

    supplierNewOrder({
      email: details?.supplierEmail,
      data: details,
      stage: 'Confirmed',
    });


     

      const supplierNotification = {
        title: `New Order Assigned`,
        body: `Order #${details?.id} has been assigned to you.`,
      };

       const adminNotification = {
        title: `Order Assigned to Supplier`,
        body: `Order #${details?.id} has been dispatched to Supplier ${data?.supplierName}.`,
      };

      ThrowNotification(orderData.adminTokens, adminNotification, {
        orderId: details?.id,
      });

      ThrowNotification(orderData.supplierTokens, supplierNotification, {
        orderId: details?.id,
      });

    console.log('🚀 ~ exports.supplierNewOrder= :');
     
    return true;
  } catch (error) {
    console.log('🚀 ~ exports.supplierNewOrder= ~ error:', error);
  }
};
