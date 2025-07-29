const orderEmailtoCustomer = require('../../helper/orderEmailtoCustomer');
const orderEmailtoLocalPatner = require('../../helper/orderEmailtoLocalPatner');
const {
  dataForEmailAndNotifications,
} = require('../../utils/emailsNotificationsData');
const { order } = require('../../models');
const Stripe = require('../stripe');
const {
  sentPaymentInvoiceEvent,
} = require('../events/sentPaymentInvoiceEvent');

exports.orderEvents = async ({ orderId }) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId);
    if (!orderData) return false;
    const { details, email } = orderData;
    let to = email ? [email] : [];
    let invoice = null;

    if (details?.email) {
      if (
        details?.emailToSendInvoices &&
        email != details?.emailToSendInvoices
      ) {
        to.push(details?.emailToSendInvoices);
      }

      orderEmailtoCustomer({
        email: to,
        data: details,
        stage: 'Confirmed',
        invoice,
      });
    }
    console.log('🚀 ~~~~~ eventDrivenCommunication ~~~~~~~ 🚀');
    return true;
  } catch (error) {
    console.log('🚀 ~ exports.orderEvents= ~ error:', error);
  }
};



exports.orderEventsToLocalPatnerOrAdmin = async ({ orderId }) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId);
    if (!orderData) return false;
    const { details, email } = orderData;
      orderEmailtoLocalPatner({
        email: details?.patnerEmail || 'info@busybeancoffee.com',
        data: details,
        stage: 'Confirmed',
        invoice,
      });
     
    console.log('🚀 ~~~~~ orderEventsToLocalPatnerOrAdmin eventDrivenCommunication ~~~~~~~ 🚀');
    return true;
  } catch (error) {
    console.log('🚀 ~ exports.orderEventsToLocalPatnerOrAdmin= ~ error:', error);
  }
};
