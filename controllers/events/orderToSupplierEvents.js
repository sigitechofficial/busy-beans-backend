const supplierNewOrder = require("../../helper/supplierNewOrder");
const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");
const ThrowNotification = require("../../utils/throwNotification");
const {
  sendIfAllowed,
  supplierPerson,
} = require("../../utils/emailSendGate");

exports.supplierNewOrderEvent = async ({ orderId, orderType = "customer" }) => {
  try {
    console.log("🚀 ~ orderType:", orderType);
    const orderData = await dataForEmailAndNotifications(orderId, orderType);
    if (!orderData) return false;
    const { details } = orderData;
    console.log("🚀 ~ details:", details);

    const person = supplierPerson(details);
    const sent = await sendIfAllowed({
      ...person,
      emailType: "supplier_new_order",
      orderId,
      orderType,
      recipients: details?.supplierEmail,
      send: async () => {
        await supplierNewOrder({
          email: details?.supplierEmail,
          data: details,
          stage: "Confirmed",
        });
      },
    });

    const supplierNotification = {
      title: `New Order Assigned`,
      body: `Order #${details?.id} has been assigned to you.`,
    };

    const adminNotification = {
      title: `Order Assigned to Supplier`,
      body: `Order #${details?.id} has been dispatched to Supplier ${details?.supplierName}.`,
    };

    ThrowNotification(orderData.adminTokens, adminNotification, {
      orderId: details?.id,
    });

    ThrowNotification(orderData.supplierTokens, supplierNotification, {
      orderId: details?.id,
    });

    console.log("🚀 ~ exports.supplierNewOrder= :");

    return { sent };
  } catch (error) {
    console.log("🚀 ~ exports.supplierNewOrder= ~ error:", error);
  }
};
