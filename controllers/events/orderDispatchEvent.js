const orderDispatch = require("../../helper/orderDispatch");
const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");
const ThrowNotification = require("../../utils/throwNotification");

exports.orderDispatchEvent = async ({ orderId, orderType = "customer" }) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId, orderType);
    if (!orderData) return false;
    const { details, email } = orderData;
    let to = email ? [email] : [];
    if (details?.email) {
      if (details?.dispatchEmail && email != details?.dispatchEmail) {
        const emailArray = details?.dispatchEmail
          ? details?.dispatchEmail.split(/\s*,\s*/)
          : []; // This will split by commas with or without spaces
        to = to.concat(emailArray);
      }
      to = [...new Set(to)];
      console.log("🚀 ~ to:", JSON.stringify(to));
      orderDispatch({ email: to, data: details });
    }
    console.log("🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀");
    return true;
  } catch (error) {
    console.log("🚀 ~ exports.sendQuotation = ~ error:", error);
  }
};
