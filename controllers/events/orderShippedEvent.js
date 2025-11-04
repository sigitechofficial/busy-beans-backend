const orderShippedEmail = require("../../helper/orderShipped");
const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");

exports.orderShippedEvent = async ({ orderId, orderType = "customer" }) => {
  console.log("🚀 ~ orderType:", orderType);
  console.log("🚀 ~ orderType:", orderType);
  console.log("🚀 ~ orderType:", orderType);
  console.log("🚀 ~ orderType:", orderType);
  console.log("🚀 ~ orderType:", orderType);
  console.log("🚀 ~ orderType:", orderType);
  console.log("🚀 ~ orderType:", orderType);
  console.log("🚀 ~ orderType:", orderType);
  console.log("🚀 ~ orderType:", orderType);
  console.log("🚀 ~ orderType:", orderType);
  try {
    const orderData = await dataForEmailAndNotifications(orderId, orderType);
    if (!orderData) return false;
    const { details } = orderData;
    orderShippedEmail({
      email: details?.patnerEmail || "info@busybeancoffee.com",
      data: details,
    });
    console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
    return true;
  } catch (error) {
    console.log("🚀 ~ exports.sendQuotation = ~ error:", error);
  }
};
