const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env
const stripe = require('stripe')(STRIPE_SECRET_KEY)
const AppError = require('../utils/appError') 

function convertToCents(amount) {
  return Math.round(amount * 100)
}
/*
 *  1:  Create Customer ________________________
 */
async function addCustomer({name, email}) {
  try {
    const customer = await stripe.customers.create({ name, email })
    console.log('ðŸš€ ~ addCustomer ~ customer:', customer.id)
    return customer.id
  } catch (error) {
    console.error(error)
    throw new AppError(`${error.message} `, 200)
  }
}

async function financialConnectionsSession({customerId}) {
  try {
  
    const session = await stripe.financialConnections.sessions.create({
      account_holder: {
        type: 'customer',
        customer: customerId,
      },
      permissions: ['payment_method'],
    }); 
    return { url: session.url }   
  } catch (error) {
    console.error(error)
    throw new AppError(`${error.message}`, 200)
  }
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
  createPaymentIntent,
  addCustomer,
  financialConnectionsSession
}
// sessionCheckoutPaymnet --- check payment destination
// sessionCheckoutPaymnet --- check payment destination
