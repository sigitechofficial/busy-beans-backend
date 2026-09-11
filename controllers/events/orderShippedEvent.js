const orderShippedEmail = require("../../helper/orderShipped");
const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");
const {
  sendIfAllowed,
  orderPerson,
} = require("../../utils/emailSendGate");

exports.orderShippedEvent = async ({ orderId, orderType = "customer" }) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId, orderType);
    if (!orderData) return false;
    const { details } = orderData;
    const person = orderPerson(details, orderType);
    const sent = await sendIfAllowed({
      ...person,
      emailType: "order_shipped",
      orderId,
      orderType,
      recipients: details?.patnerEmail || "info@busybeancoffee.com",
      send: async () => {
        await orderShippedEmail({
          email: details?.patnerEmail || "info@busybeancoffee.com",
          data: details,
        });
      },
    });
    return { sent };
  } catch (error) {
    console.log("🚀 ~ exports.sendQuotation = ~ error:", error);
  }
};
