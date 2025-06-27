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
    const customer = await stripe.customers.create({
      name,
      email,
      address: {
        country: 'US', // 👈 Sets default country
      },
    });
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
        type: "customer",
        customer: customerId
      },
      permissions: ["payment_method", "balances"],
      filters: {
        countries: ["US"]
      }
    });
    
    return session   
  } catch (error) {
    console.error(error)
    throw new AppError(`${error.message}`, 200)
  }
}

// Retrieve and attach bank account PaymentMethod
async function attachBankAccountPaymentMethod({ sessionId, customerId }) {
  try {
     const session = await stripe.financialConnections.sessions.retrieve(sessionId);
    const bankAccountId = session.accounts[0].id;

    // Stripe creates PaymentMethod automatically
    const bankAccount = await stripe.financialConnections.account.retrieve(bankAccountId);

    const paymentMethodId = bankAccount.payment_method;

    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });

    // Optionally set as default
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    return { paymentMethodId }   

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
        console.log('🚀 ~ exports.order= ~ order:', order)

    const { vat, items} = order
    for (const item of items) {
      const { product, qty, price } = item;
      await stripe.invoiceItems.create({
        customer: order?.stripeCustomerId,
        amount: convertToCents(price), // Stripe requires integer cents
        currency, 
        description:  qty > 1
      ? `${product} – Pack of ${qty}`
      : `${product} – 1 Unit`,
      });
      console.log('🚀 ~ exports.onlineAppointmentConfirm= ~ item:', convertToCents(price))
    }
 
    if (vat && vat > 0 ) {
      const vatAmount = convertToCents(vat);
      console.log(`Creating VAT invoice item, amount: ${vatAmount} cents`);
     const vatItem =  await stripe.invoiceItems.create({
        customer: order?.stripeCustomerId,
        amount: vatAmount,
        currency,
        description: 'VAT',
      });
            console.log(`Creating VAT invoice item, amount: $} cents`,vatItem.id);
    }
    
    // Step 2: Create the invoice
    const invoice = await stripe.invoices.create({
      customer: order?.stripeCustomerId,
      collection_method: 'charge_automatically', // ✅ REQUIRED
      auto_advance: true, // Let Stripe attempt to collect payment
      metadata: {
        orderId: order?.id,
        localPatnerAccount: order?.connectAccountId,
        salesRepId: order?.salesRepId,
      },
      pending_invoice_items_behavior: 'include',
    });
    
    // const session = await stripe.checkout.sessions.create({
    //   payment_method_types: ['card', 'us_bank_account'], // Apple Pay & GPay are covered by 'card'
    //   line_items: [{
    //     price_data: {
    //       currency: 'usd',
    //       product_data: {
    //         name: 'Your Product',
    //       },
    //       unit_amount: 1000,
    //     },
    //     quantity: 1,
    //   }],
    //   mode: 'payment',
    //   customer: order?.stripeCustomerId,
    //   success_url: 'https://google.com',
    //   cancel_url: 'https://youtube.com',
    // });


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


async function transferToLocalPatners({amount,localPartnerAccountId,orderId}) {
  try{
    const transfer = await stripe.transfers.create({
      amount: convertToCents(amount),
      currency: 'usd',
      destination: localPartnerAccountId,
      description: `Commission of order ${orderId}`,
   });
  return transfer
  } catch (error) {
    console.error('Invoice creation failed:', error);
     throw new AppError(`${error?.message}`, 200)
  }
}

async function getInvoiceDetails ({invoiceId}) {
  console.log("🚀 ~ getInvoiceDetails ~ getInvoiceDetails:",  )
  try{
   const invoice = await stripe.invoices.retrieve(invoiceId);
    return {
      invoiceId: invoice.id,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      status: invoice.status,
      total: invoice.amount_due,
    };
  } catch (error) {
    console.error('Invoice getInvoiceDetails failed:', error);
     throw new AppError(`${error?.message}`, 200)
  }
}

async function retrieveConnectAccount({ accountId }) {
  try {
    const account = await stripe.accounts.retrieve(accountId);

    // Check if the account can handle charges
    if (!account.charges_enabled) {
      throw new AppError('Charges are not enabled for this account.', 400);
    }

    // Check if the account can handle payouts
    if (!account.payouts_enabled) {
      throw new AppError('Payouts are not enabled for this account.', 400);
    }

    // Check if the account details have been fully submitted
    if (!account.details_submitted) {
      throw new AppError('Account details are not fully submitted.', 400);
    }

    // Check if there are any requirements pending (errors or verification)
    if (account.requirements.errors.length > 0 || account.requirements.pending_verification.length > 0) {
      throw new AppError('There are pending verification or requirements errors.', 400);
    }

    // If all checks pass, return the account information
    return account 

  } catch (error) {
    console.error(error);
    throw new AppError(`${error.message}`, 200); // Customize error message if necessary
  }
}


async function createStripeLoginLink({accountId}) {
  try {
    const loginLink = await stripe.accounts.createLoginLink(accountId)
    return loginLink.url
  } catch (error) {
    console.error('Error creating login link:', error)
    return null
  }
}

module.exports = {
  attachBankAccountPaymentMethod,
  createStripeLoginLink,
  retrieveConnectAccount,
  createPaymentIntent,
  addCustomer,
  financialConnectionsSession, 
  createConnectAccount,
  createCheckoutSession,
  createStripeAccountLink,
  createInvoiceWithItems,
  transferToLocalPatners,
  getInvoiceDetails
}
// sessionCheckoutPaymnet --- check payment destination
// sessionCheckoutPaymnet --- check payment destination
