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


async function createConnectAccount({email, country = 'US', returnUrl }) {
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
    return_url:returnUrl ||
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

async function createStripeAccountLink({accountId,returnUrl}) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: 'https://example.com/reauth',
    return_url:returnUrl ||
      'https://google.com',
    type: 'account_onboarding',
  })
  return accountLink.url
}


async function createInvoiceWithItems({ customerId, order, currency = 'usd', dueInDays = 7 }) {
  try {
    // Step 1: Create invoice items
    const {vat , items} = order
    for (const item of items) {
      const { product, qty, price } = item;
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: convertToCents(price), // Stripe requires integer cents
        currency,
        description: `${product} x ${qty}`,
      });
    }

    await stripe.invoiceItems.create({
        customer: customerId,
        amount: convertToCents(vat), // Stripe requires integer cents
        currency,
        description: `Vat`,
    });

    // Step 2: Create the invoice
    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: dueInDays,
      auto_advance: true,
      metadata: {
        orderId: order?.id, 
        localPatnerAccount: order?.connectAccountId, 
        salesRepId: order?.salesRepId, 
      }
    });

    // Step 3: Finalize the invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    return {
      invoiceId: finalizedInvoice?.id,
      hostedInvoiceUrl: finalizedInvoice?.hosted_invoice_url,
      invoicePdf: finalizedInvoice?.invoice_pdf,
      status: finalizedInvoice?.status,
      total: finalizedInvoice?.amount_due,
    };

  } catch (error) {
    console.error('Invoice creation failed:', error);
     throw new AppError(`${error?.message}`, 200)
  }
}


async function transferToLocalPatners({amount,localPartnerAccountId,invoice}) {
  try{
    const transfer = await stripe.transfers.create({
      amount: convertToCents(amount),
      currency: 'usd',
      destination: localPartnerAccountId,
      description: `Payout for invoice ${invoice.id}, order ${invoice.metadata.orderId}`,
   });
  return transfer
  } catch (error) {
    console.error('Invoice creation failed:', error);
     throw new AppError(`${error?.message}`, 200)
  }
}

module.exports = {
  createPaymentIntent,
  addCustomer,
  financialConnectionsSession, 
  createConnectAccount,
  createCheckoutSession,
  createStripeAccountLink,
  createInvoiceWithItems,
  transferToLocalPatners
}
// sessionCheckoutPaymnet --- check payment destination
// sessionCheckoutPaymnet --- check payment destination
