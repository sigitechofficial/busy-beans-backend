const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env
const stripe = require('stripe')(STRIPE_SECRET_KEY)
 
const { user } = require('../../models');
 
const endpointSecret = `whsec_IfLq0Y34XAcdWihxkUrLojybI80kOUE5`

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
    default:
      console.log(`Unhandled event type ${event.type}`)
  }
 
  res.json({ received: true })
}
const paymentMethodAttch = async (event) => {
  try {
    const paymentMethod = event.data.object;
    const customerId = paymentMethod.customer;
    await user.update({defaultPaymentMethod:paymentMethod?.id},{stripeCustomerId:customerId})
  } catch (error) {
    console.error('Error handling payment_method.attached:', error)
  }
}
 