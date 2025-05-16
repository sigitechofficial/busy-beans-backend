const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env
const stripe = require('stripe')(STRIPE_SECRET_KEY)
const AppError = require('../utils/appError') 


async function createPaymentIntent(amount) {
  try {
    const { amount } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
    });
    return { clientSecret: paymentIntent.client_secret }
  } catch (error) {
    console.error(error)
    throw new AppError(`${error.message}`, 200)
  }
}
module.exports = {
  createPaymentIntent
}
// sessionCheckoutPaymnet --- check payment destination
// sessionCheckoutPaymnet --- check payment destination
