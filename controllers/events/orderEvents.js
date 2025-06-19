 
const orderEmailtoCustomer = require('../../helper/orderEmailtoCustomer')
const {
dataForEmailAndNotifications
} = require('../../utils/emailsNotificationsData')
const {order} = require('../../models');
const Stripe = require('../stripe');
const { sentPaymentInvoiceEvent } = require('../events/sentPaymentInvoiceEvent');

exports.orderEvents = async ({orderId}) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId)
    if (!orderData) return false
    const { details,email } = orderData
      const invoice = details.invoiceId ?await Stripe.getInvoiceDetails({invoiceId:details.invoiceId }):await Stripe.createInvoiceWithItems({customerId:details.stripeCustomerId , order:details}) 

      await order.update(invoice,{where:{id:details.id}})
      // sentPaymentInvoiceEvent({email,data:details,invoice})

    if (details?.email) {
      let to = [details?.email]
     
      if(details?.emailToSendInvoices && email != details?.emailToSendInvoices) {
        to.push(details?.emailToSendInvoices)
      }

      orderEmailtoCustomer({
       email: to,
       data: details,
       stage: 'Confirmed',
       invoice
      })
    }
    console.log('🚀 ~~~~~ eventDrivenCommunication ~~~~~~~ 🚀')
    return true
  } catch (error) {
    console.log('🚀 ~ exports.orderEvents= ~ error:', error)
  }
}

 