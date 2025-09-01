const paidInvoiceEmail = require('../../helper/paidInvoiceEmail');
const paidInvoiceEmailAdminOrLocalPatner = require('../../helper/paidInvoiceEmailAdminOrLocalPatner');
const {
  dataForEmailAndNotifications,
} = require('../../utils/emailsNotificationsData');
exports.paidInvoiceEmailEvent = async ({ orderId }) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId);
    if (!orderData) return false;
    const { details, email } = orderData;
    paidInvoiceEmail({ email: email, data: details, invoice: null });
    console.log('🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀');
    return true;
  } catch (error) {
    console.log('🚀 ~ exports.paidInvoiceEmailEvent = ~ error:', error);
  }
};

exports.paidInvoiceAdminOrLocalPatnerEvent = async ({ orderId }) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId);
    if (!orderData) return false;
    const { details, email } = orderData;
    paidInvoiceEmailAdminOrLocalPatner({
      email: details?.patnerEmail || 'info@busybeancoffee.com',
      data: details,
      invoice: null,
    });
    console.log('🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀');
    return true;
  } catch (error) {
    console.log('🚀 ~ exports.sendQuotation = ~ error:', error);
  }
};

exports.paidInvoiceAdminOrLocalPatnerEventAndCustomer = async ({ orderId }) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId);
    if (!orderData) return false;
    const { details, email } = orderData;
    paidInvoiceEmailAdminOrLocalPatner({
      email: details?.patnerEmail || 'info@busybeancoffee.com',
      data: details,
      invoice: null,
    });
    paidInvoiceEmail({ email: email, data: details, invoice: null });
    console.log('🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀');
    return true;
  } catch (error) {
    console.log('🚀 ~ exports.sendQuotation = ~ error:', error);
  }
};
