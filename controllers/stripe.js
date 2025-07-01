const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env
const Stripe = require('stripe');
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
  // beta: ["financial_connections_sessions_beta"] // ✅ Add this line
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
  
   const session = await stripe.setupIntents.create({
  customer: customerId,
  payment_method_types: ['us_bank_account'],
  usage:"off_session",
  payment_method_options: {
    us_bank_account: {
      financial_connections: {
        permissions: ['payment_method', 'balances']
      }
    }
  }
});
    
    return session   
  } catch (error) {
    console.error(error)
    throw new AppError(`${error.message}`, 200)
  }
}

// Retrieve and attach bank account PaymentMethod
 

async function attachBankAccountPaymentMethod({ paymentMethodId, customerId }) {
try {
 
    if (!paymentMethodId) {
      throw new Error("No payment method found on SetupIntent. Did the user finish connecting the bank?");
    }

    // 2. Attach to customer (if not already attached)
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });

    // 3. (Optional) Set as default for invoices/payments
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    return {
      success: true,
      paymentMethodId
    };

  } catch (error) {
    console.error("❌ attachBankAccountPaymentMethod error:", error);
    throw new Error(`Bank account linking failed: ${error.message}`);
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
    refresh_url: 'https://admin.busybeancoffee.com/sign-in',
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

    const { shippingCharges,billingAddress,vat, items} = order
    console.log("🚀 ~ createInvoiceWithItems ~ billingAddress:", billingAddress)
    console.log("🚀 ~ createInvoiceWithItems ~ billingAddress:", billingAddress)
    console.log("🚀 ~ createInvoiceWithItems ~ order?.stripeCustomerId:", order?.stripeCustomerId)
    
    if (billingAddress) {
      console.log("🚀 ~ createInvoiceWithItems ~ billingAddress:", billingAddress)
      console.log("🚀 ~ createInvoiceWithItems ~ billingAddress:", billingAddress)
      console.log("🚀 ~ createInvoiceWithItems ~ billingAddress:", billingAddress)
      await stripe.customers.update(order?.stripeCustomerId, {
       address: {
    line1: '123 Main Street',
    city: 'Toba Tek Singh',
    state: 'Punjab',
    postal_code: '36050',
    country: 'PK', // Must be ISO 2-letter code
  },
  
        name: order?.customerName || undefined, // Optional if available
        email: order?.email || undefined, // Optional if available
      });
    }


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
 
    if (shippingCharges && (shippingCharges*1) > 0 ) {
      const shippingChargesAmount = convertToCents(shippingCharges);
      console.log(`Creating shipping charges invoice item, amount: ${shippingChargesAmount} cents`);
     const shippingChargesItem =  await stripe.invoiceItems.create({
        customer: order?.stripeCustomerId,
        amount: shippingChargesAmount,
        currency,
        description: 'Shipping Charges',
      });
            console.log(`Creating shipping charges invoice item, amount: $} cents`,shippingChargesItem.id);
    }


     if (vat && vat > 0 ) {
      const vatAmount = convertToCents(vat);
      console.log(`Creating  invoice item, amount: ${vatAmount} cents`);
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
      custom_fields: order?.poNumber ? [{
          name: "PO Number",
          value: order.poNumber,
        }] : undefined,
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


async function transferToLocalPatners({amount,localPartnerAccountId,orderId,invoiceId,paymentIntentId}) {
  try{
      // Step 1: Retrieve the invoice
    const invoice =invoiceId? await stripe.invoices.retrieve(invoiceId):null;
    const piId = invoice && paymentIntentId? invoice.payment_intent:paymentIntentId 
    
    // Step 2: Get the PaymentIntent from the invoice
    const paymentIntent = await stripe.paymentIntents.retrieve(piId);

    // Step 3: Get the Charge
       const charge = paymentIntent.charges.data[0];

    // Step 4: Retrieve the balance transaction (to get Stripe fee)
    const balanceTransaction = await stripe.balanceTransactions.retrieve(charge.balance_transaction);

    // Step 5: Extract Stripe values (already in cents)
    const totalAmountCents = balanceTransaction.amount;
    const stripeFeeCents = balanceTransaction.fee;

    // Step 6: Convert commission amount from dollars to cents
    const commissionCents = convertToCents(amount);

    // Step 7: Calculate proportional Stripe fee based on commission
    const proportionalStripeFee = Math.round((commissionCents / totalAmountCents) * stripeFeeCents);

    // Step 8: Calculate net partner amount
    const netPartnerAmount = commissionCents - proportionalStripeFee;

    // Step 9: Create readable description
    const description = `Partner Commission: $${commissionAmount.toFixed(2)} - Stripe Fee: $${(proportionalStripeFee / 100).toFixed(2)} = Net: $${(netPartnerAmount / 100).toFixed(2)}`;

    // Step 10: Create the transfer
    const transfer = await stripe.transfers.create({
      amount: netPartnerAmount,               // in cents
      currency: 'usd',
      destination: connectAccountId,          // Connect account ID
      transfer_group: invoice.id,             // Optional tracking
      description,
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
    if (account?.requirements?.errors?.length > 0 || account?.requirements?.pending_verification?.length > 0) {
      throw new AppError('There are pending verification or requirements errors.', 400);
    }

    // If all checks pass, return the account information
    return account 

  } catch (error) {
    console.error(error);
    throw new AppError(`${error.message}`, 400); // Customize error message if necessary
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

async function pullAmountPaymentIntentFromBankAccount({ amount, savedPaymentMethodId, customerId }) {
  try {

    const cents = convertToCents(amount);
    console.log("🚀 ~ pullAmountPaymentIntentFromBankAccount ~ amount:", amount)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: cents,
      currency: "usd",
      customer: customerId,
      payment_method: savedPaymentMethodId,
      payment_method_types: ["us_bank_account"],
      off_session: true,
      confirm: true
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status // will likely be "processing"
    };

  } catch (error) {
    console.error("❌ ACH pull failed:", error);
    throw new AppError(`${error.message}`, 200);
  }
}

module.exports = {
  pullAmountPaymentIntentFromBankAccount,
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
