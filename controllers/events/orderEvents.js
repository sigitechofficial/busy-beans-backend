const orderEmailtoCustomer = require("../../helper/orderEmailtoCustomer");
const orderEmailtoLocalPatner = require("../../helper/orderEmailtoLocalPatner");
const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");
const { order } = require("../../models");
const Stripe = require("../stripe");
const {
  sentPaymentInvoiceEvent,
} = require("../events/sentPaymentInvoiceEvent");
const ThrowNotification = require("../../utils/throwNotification");
const {
  importCustomersToQuickBooks,
} = require("../../services/qboCustomerService");
const {
  sendIfAllowed,
  orderPerson,
  partnerOrHq,
} = require("../../utils/emailSendGate");
exports.orderEvents = async ({ orderId, orderType = "customer" }) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId, orderType);
    if (!orderData) return false;
    const { details, email } = orderData;
    let to = email ? [email] : [];
    let invoice = null;

    let sent = true;
    if (details?.email) {
      if (details?.dispatchEmail && email != details?.dispatchEmail) {
        to.push(details?.dispatchEmail);
      }

      const person = orderPerson(details, orderType);
      sent = await sendIfAllowed({
        ...person,
        emailType: "order_confirmation",
        orderId,
        orderType,
        recipients: to,
        send: async () => {
          await orderEmailtoCustomer({
            email: to,
            data: details,
            stage: "Confirmed",
            invoice,
          });
        },
      });
    }

    const adminNotification = {
      title: `New Order Received`,
      body: `A new Order #${details?.id} has been placed by ${details?.companyName}`,
    };

    ThrowNotification(orderData.adminTokens, adminNotification, {
      orderId: details?.id,
    });

    ThrowNotification(orderData.salesRepTokens, adminNotification, {
      orderId: details?.id,
    });

    console.log("🚀 ~~~~~ eventDrivenCommunication ~~~~~~~ 🚀");
    return { sent };
  } catch (error) {
    console.log("🚀 ~ exports.orderEvents= ~ error:", error);
  }
};

exports.orderEventsToLocalPatnerOrAdmin = async ({
  orderId,
  orderType = "customer",
}) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId, orderType);
    if (!orderData) return false;
    const { details, email } = orderData;
    const person = partnerOrHq(details);
    const sent = await sendIfAllowed({
      ...person,
      emailType: "partner_new_order",
      orderId,
      orderType,
      recipients: details?.patnerEmail || "info@busybeancoffee.com",
      send: async () => {
        await orderEmailtoLocalPatner({
          email: details?.patnerEmail || "info@busybeancoffee.com",
          data: details,
          stage: "Confirmed",
        });
      },
    });

    console.log(
      "🚀 ~~~~~ orderEventsToLocalPatnerOrAdmin eventDrivenCommunication ~~~~~~~ 🚀",
    );
    return { sent };
  } catch (error) {
    console.log(
      "🚀 ~ exports.orderEventsToLocalPatnerOrAdmin= ~ error:",
      error,
    );
  }
};
