const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env
const Stripe = require('stripe');
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15', // ✅ Add this line
});
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
      return_url: 'https://yourdomain.com/bank-connected',
    }); 
    return session   
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


async function createConnectAccount(email, country) {
    try {
  const account = await stripe.accounts.create({
    type: 'express', // You can use 'express', 'standard', or 'custom' depending on your needs
    country: country, // The country code for the account
    email, // The email address of the account holder
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    
  })

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: 'https://example.com/reauth',
    return_url:
      'https://google.com',
    type: 'account_onboarding',
  })
  return { accountLink, accountId: account.id }
  } catch (error) {
    console.error(error)
    throw new AppError(`${error.message}`, 200)
  }
}

async function createCheckoutSession(line_items, accountId, applicationFee) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: line_items,
    mode: 'payment',
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
    payment_intent_data: {
      application_fee_amount: applicationFee, // Fee amount in cents
      transfer_data: {
        destination: accountId, // Replace with the Connect account ID
      },
    },
  })
  // return session;
  return {
    url: session.url,
    total: session.amount_total,
    status: session.payment_status,
  }
}

async function createStripeAccountLink(accountId) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: 'https://example.com/reauth',
    return_url:
      'https://google.com',
    type: 'account_onboarding',
  })
  return accountLink.url
}

module.exports = {
  createPaymentIntent,
  addCustomer,
  financialConnectionsSession, 
  createConnectAccount,
  createCheckoutSession,
  createStripeAccountLink
}
// sessionCheckoutPaymnet --- check payment destination
// sessionCheckoutPaymnet --- check payment destination
