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
exports.orderEvents = async ({ orderId, orderType = "customer" }) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId, orderType);
    if (!orderData) return false;
    const { details, email } = orderData;
    let to = email ? [email] : [];
    let invoice = null;

    if (orderType == "customer") {
      if (
        details.partnerType === "direct-partner" &&
        !details.qboCustomerIdForPartner
      ) {
        importCustomersToQuickBooks({
          limitIds: [details.userId],
          userType: "customer",
        });
      } else if (details.partnerType === "drop" && !details.qboCustomerId) {
        importCustomersToQuickBooks({
          limitIds: [details.userId],
          userType: "customer",
        });
      }
    } else if (orderType == "local-partner") {
      importCustomersToQuickBooks({
        limitIds: [details.salesRepId],
        userType: "local-partner",
      });
    }

    if (details?.email) {
      if (details?.dispatchEmail && email != details?.dispatchEmail) {
        to.push(details?.dispatchEmail);
      }

      orderEmailtoCustomer({
        email: to,
        data: details,
        stage: "Confirmed",
        invoice,
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
    return true;
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
    orderEmailtoLocalPatner({
      email: details?.patnerEmail || "info@busybeancoffee.com",
      data: details,
      stage: "Confirmed",
    });

    console.log(
      "🚀 ~~~~~ orderEventsToLocalPatnerOrAdmin eventDrivenCommunication ~~~~~~~ 🚀"
    );
    return true;
  } catch (error) {
    console.log(
      "🚀 ~ exports.orderEventsToLocalPatnerOrAdmin= ~ error:",
      error
    );
  }
};
