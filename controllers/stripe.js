const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env
const stripe = require('stripe')(STRIPE_SECRET_KEY)
const AppError = require('../utils/appError') 

function convertToCents(amount) {
  return Math.round(amount * 100)
}


async function createPaymentIntent(amount) {
  try {
    const cents = convertToCents(amount);
    const paymentIntent = await stripe.paymentIntents.create({
      amount:cents,
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
