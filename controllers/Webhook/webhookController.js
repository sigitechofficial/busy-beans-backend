const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env
const stripe = require('stripe')(STRIPE_SECRET_KEY)
const Stripe = require('../stripe');

 
const { user, salesRep, transfersToSalesRep ,Item } = require('../../models');
const order = require('../../models/order');
 
const endpointSecret = `whsec_1Xqm67Agpa70u6fqQt85NergNgJmsQAN`

exports.stripeSubscriptionWebhookEventHandler = async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event
  console.log('⚠️⚠️⚠️ Webhook signature verification.')

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret)
    console.log(
      '🚀 ~~~~~~~~~~~ exports.stripeSubscriptionWebhookEventHandler= ~ event:',
      JSON.stringify(event),
    )
  } catch (err) {
    console.error('⚠️⚠️⚠️ Webhook signature verification failed.', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }
 
  console.log('🚀🚀🚀 ~~~~~~~~~~ >  EVENT TYPE }:', event.type)
  switch (event.type) {
    case 'payment_method.attached':
      await paymentMethodAttch(
        event
      )
      break
    case 'invoice.paid':
      await invoicePaid(
        event
      )
      break
    default:
      console.log(`Unhandled event type ${event.type}`)
  }
 
  res.json({ received: true })
}
const invoicePaid = async (event) => {
  try {
 const invoice = event.data.object;
  const localPartnerId = invoice.metadata?.salesRepId;
  const localPatnerAccount = invoice.metadata?.localPatnerAccount;
  const orderId = invoice.metadata?.orderId;
  if(!localPartnerId) {
  await order.update({paymentStatus:'done'},{where:{orderId}})
  return true
  }
 if(localPatnerAccount){
    const totalWholesalePrice = await Item.sum('wholeSalePrice', {
      where: {
        orderId: orderId, 
      },
    });
      const transfer =  await Stripe.transferToLocalPatners({amount:totalWholesalePrice,localPartnerAccountId:localPatnerAccount,invoice})

      await transfersToSalesRep.create({
        amount: totalWholesalePrice, // as string, e.g. cents in USD
        tranferId: transfer?.id, // Stripe transfer ID
        salesRepId:localPartnerId,
        orderId:orderId
      });
      await order.update({paymentStatus:'done',localPatnerCommission:totalWholesalePrice},{where:{orderId}})
  }
  return true
  } catch (error) {
    console.error('Error handling invoice.paid:', error)
  }
}

const paymentMethodAttch = async (event) => {
  try {
    const paymentMethod = event.data.object;
    const customerId = paymentMethod.customer;
    await user.update({defaultPaymentMethod:paymentMethod?.id},{stripeCustomerId:customerId})
    return true
  } catch (error) {
    console.error('Error handling payment_method.attached:', error)
    return false
  }
}
 