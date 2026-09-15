const orderDispatch = require("../../helper/orderDispatch");
const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");
const ThrowNotification = require("../../utils/throwNotification");
const {
  sendIfAllowed,
  orderPerson,
} = require("../../utils/emailSendGate");

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
          : [];
        to = to.concat(emailArray);
      }
      to = [...new Set(to)];
      const person = orderPerson(details, orderType);
      const sent = await sendIfAllowed({
        ...person,
        emailType: "order_dispatch",
        orderId,
        orderType,
        recipients: to,
        send: async () => {
          await orderDispatch({ email: to, data: details });
        },
      });
      return { sent };
    }
    return { sent: true };
  } catch (error) {
    console.log("🚀 ~ exports.sendQuotation = ~ error:", error);
  }
};
