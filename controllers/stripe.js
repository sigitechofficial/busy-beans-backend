const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env;
require('dotenv').config();

const Stripe = require('stripe');
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
  // beta: ["financial_connections_sessions_beta"] // ✅ Add this line
});

const { billingAddress } = require('../models');

const AppError = require('../utils/appError');

function estimateStripeFeeFromDollars(amountInDollars) {
  const parsed = parseFloat(amountInDollars);
  if (isNaN(parsed)) throw new Error('Invalid dollar amount');

  const fee = parsed * 0.029 + 0.3; // 2.9% + $0.30
  return fee; // Return in dollars with 2 decimals
}

function convertToCents(amount) {
  return Math.round(amount * 100);
}
function convertToDollars(cents) {
  return cents / 100;
}
/*
 *  1:  Create Customer ________________________
 */
async function addCustomer({ name, email }) {
  try {
    const customer = await stripe.customers.create({
      name,
      email,
      address: {
        country: 'US', // 👈 Sets default country
      },
    });
    console.log('ðŸš€ ~ addCustomer ~ customer:', customer.id);
    return customer.id;
  } catch (error) {
    console.error(error);
    throw new AppError(`${error.message} `, 200);
  }
}

async function financialConnectionsSession({ customerId }) {
  try {
    const session = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['us_bank_account'],
      usage: 'off_session',
      payment_method_options: {
        us_bank_account: {
          financial_connections: {
            permissions: ['payment_method', 'balances'],
          },
        },
      },
    });

    return session;
  } catch (error) {
    console.error(error);
    throw new AppError(`${error.message}`, 200);
  }
}

// Retrieve and attach bank account PaymentMethod

async function attachBankAccountPaymentMethod({ paymentMethodId, customerId }) {
  try {
    if (!paymentMethodId) {
      throw new Error(
        'No payment method found on SetupIntent. Did the user finish connecting the bank?',
      );
    }

    // 2. Attach to customer (if not already attached)
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // 3. (Optional) Set as default for invoices/payments
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return {
      success: true,
      paymentMethodId,
    };
  } catch (error) {
    console.error('❌ attachBankAccountPaymentMethod error:', error);
    throw new Error(`Bank account linking failed: ${error.message}`);
  }
}

// when no localpatner then adminReceivableAmount
async function createPaymentIntent({
  adminReceivableAmount,
  localPartnerAccountId,
  localPatnerCommission,
  hasLocalPatner,
  paymentMethodId = null,
  stripeCustomer = null,
  metadata = null,
}) {
  try {
    console.log(
      `🚀 ~ createPaymentIntent ~ {
  adminReceivableAmount,
  localPartnerAccountId,
  localPatnerCommission,
  hasLocalPatner,
  paymentMethodId = null,
  stripeCustomer = null,
}:`,
      {
        adminReceivableAmount,
        localPartnerAccountId,
        localPatnerCommission,
        hasLocalPatner,
        paymentMethodId,
        stripeCustomer,
      },
    );
    const input = {
      amount: convertToCents(adminReceivableAmount),
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true, // enables card, bank, Apple Pay, etc.
      },
    };

    let stripeFee = 0;
    let localPartnerAmount = 0;
    let adminAmount = adminReceivableAmount;
    let totalBill = adminReceivableAmount;

    if (localPartnerAccountId && hasLocalPatner && localPatnerCommission > 0) {
      input.transfer_data = {
        destination: localPartnerAccountId,
      };
      stripeFee = estimateStripeFeeFromDollars(adminReceivableAmount);
      adminReceivableAmount = adminReceivableAmount - localPatnerCommission;
      adminAmount = adminReceivableAmount;

      const adminProfitCents =
        convertToCents(adminAmount) + convertToCents(stripeFee);
      input.application_fee_amount = adminProfitCents;
      localPartnerAmount = localPatnerCommission;
      input.amount = convertToCents(totalBill);
    }

    if (paymentMethodId) {
      input.customer = stripeCustomer;
      input.payment_method = paymentMethodId;
      input.confirm = true; // charge now
      // input.statement_descriptor = 'BUSYBEANCOFFEE';
      input.description = `Payment captured for invoice ${metadata.invoiceNumber} using card on file.`;
      input.off_session = true; // no customer interaction
      input.capture_method = 'automatic';
      input.metadata = {
        platform: 'Busy Beans Coffee inc.',
        type: 'saved-card',
        ...metadata,
      };
    }

    console.log('🚀 ~ createPaymentIntent ~ input:', input);
    const paymentIntent = await stripe.paymentIntents.create(input);
    // console.error("🚀🚀🚀🚀🚀 ~ createPaymentIntent",paymentIntent);

    if (paymentIntent && paymentMethodId) {
      return {
        status: true,
        hasLocalPatner,
        data: {
          proportionalStripeFee: stripeFee,
          localPatnerCommission: localPartnerAmount,
          adminReceivableAmount: adminAmount,
          adminReceivableStatus: true,
          paymentStatus: 'done',
          invoicePaidDate: new Date(),
          pulloutDate: Date.now(),
          paymentMethod: 'card',
          paymentMethodId: paymentMethodId,
          paymentIntentId: paymentIntent?.id,
        },
      };
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error('🚀🚀🚀🚀🚀 ~ createPaymentIntent', error);

    if (paymentMethodId) {
      // If Stripe requires authentication (3DS)
      if (
        error.code === 'authentication_required' ||
        (error.payment_intent &&
          error.payment_intent.status === 'requires_action')
      ) {
        return {
          status: false,
          message:
            'Authentication required for this payment method. Please complete 3D Secure authentication or use another card.',
        };
      }

      // 🚫 Destination account missing transfers capability
      if (error?.code === 'insufficient_capabilities_for_transfer') {
        return {
          status: false,
          message:
            'The local partner’s Stripe account is not fully enabled to receive transfers. Please ask the partner to complete their Stripe onboarding and enable the transfers capability.',
        };
      }

      // Otherwise return the raw error message
      return {
        status: false,
        message: error.message || 'Payment failed',
      };
    }

    console.error(error);
    throw new AppError(`${error.message}`, 200);
  }
}

async function createConnectAccount({ email, country = 'US', returnUrl }) {
  try {
    const account = await stripe.accounts.create({
      type: 'express', // You can use 'express', 'standard', or 'custom' depending on your needs
      country: country, // The country code for the account
      email, // The email address of the account holder
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
        us_bank_account_payments: { requested: true },
      },
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'https://admin.busybeancoffee.com/sign-in',
      return_url: returnUrl || 'https://google.com',
      type: 'account_onboarding',
    });

    return { accountLink, accountId: account.id };
  } catch (error) {
    console.error(error);
    throw new AppError(`${error.message}`, 200);
  }
}

async function createStandardConnectAccount({ email, returnUrl }) {
  try {
    // Step 1: Create an account (optional – most often not needed for Standard)
    const account = await stripe.accounts.create({
      type: 'standard',
      email,
    });

    // Step 2: Create an OAuth link
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: 'ca_SQfrJvPViMRyHtkd9guC3v7lEWYDzQdq', // From Stripe dashboard (Connect > Settings)
      scope: 'read_write',
      redirect_uri:
        returnUrl || 'https://yourapp.com/stripe/onboarding-complete',
      'stripe_user[email]': email,
    });

    const accountLink = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;

    return { accountLink, accountId: account.id };
  } catch (error) {
    console.error(error);
    throw new AppError(`${error.message}`, 200);
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
  });
  // return session;
  return {
    url: session.url,
    total: session.amount_total,
    status: session.payment_status,
  };
}

async function createStripeAccountLink({ accountId, returnUrl }) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: 'https://example.com/reauth',
    return_url: returnUrl || 'https://google.com',
    type: 'account_onboarding',
  });
  return accountLink.url;
}

// async function createInvoiceWithItems({ customerId, order, currency = 'usd', dueInDays = 7 }) {
//   try {
//     // Step 1: Create invoice items
//         console.log('🚀 ~ exports.order= ~ order:', order)

//     const { shippingCharges,vat, items} = order
//     console.log("🚀 ~ createInvoiceWithItems ~ order?.stripeCustomerId:", order?.stripeCustomerId)

//     const billAddress  = await billingAddress.findOne({where:{userId:order.userId}})

//     if (billAddress) {
//       console.log("🚀 ~ createInvoiceWithItems ~ billAddress:", billAddress)
//       const userAddress = {
//         line1: billAddress?.addressLineOne|| undefined,
//         city: billAddress?.town|| undefined,
//         state: billAddress?.state|| undefined,
//         postal_code: billAddress?.zipCode|| undefined,
//         country: billAddress.country|| undefined, // Must be ISO 2-letter code
//       }
//       await stripe.customers.update(order?.stripeCustomerId, {
//        address:userAddress,
//         name: order?.customerName || undefined, // Optional if available
//         email: order?.email || undefined, // Optional if available
//       });
//     }

//     for (const item of items) {
//       const { product, qty, price } = item;
//       await stripe.invoiceItems.create({
//         customer: order?.stripeCustomerId,
//         amount: convertToCents(price), // Stripe requires integer cents
//         currency,
//         description:  qty > 1
//       ? `${product} – Pack of ${qty}`
//       : `${product} – 1 Unit`,
//       });
//       console.log('🚀 ~ exports.onlineAppointmentConfirm= ~ item:', convertToCents(price))
//     }

//     if (shippingCharges && (shippingCharges*1) > 0 ) {
//       const shippingChargesAmount = convertToCents(shippingCharges);
//       console.log(`Creating shipping charges invoice item, amount: ${shippingChargesAmount} cents`);
//      const shippingChargesItem =  await stripe.invoiceItems.create({
//         customer: order?.stripeCustomerId,
//         amount: shippingChargesAmount,
//         currency,
//         description: 'Shipping Charges',
//       });
//             console.log(`Creating shipping charges invoice item, amount: $} cents`,shippingChargesItem.id);
//     }

//      if (vat && vat > 0 ) {
//       const vatAmount = convertToCents(vat);
//       console.log(`Creating  invoice item, amount: ${vatAmount} cents`);
//      const vatItem =  await stripe.invoiceItems.create({
//         customer: order?.stripeCustomerId,
//         amount: vatAmount,
//         currency,
//         description: 'VAT',
//       });
//             console.log(`Creating VAT invoice item, amount: $} cents`,vatItem.id);
//     }

//     // Step 2: Create the invoice

//     const invoice = await stripe.invoices.create({
//       customer: order?.stripeCustomerId,
//       collection_method: 'charge_automatically', // ✅ REQUIRED
//       auto_advance: false, // Let Stripe attempt to collect payment
//       metadata: {
//         orderId: order?.id,
//         localPatnerAccount: order?.connectAccountId,
//         salesRepId: order?.salesRepId,
//       },
//       custom_fields: order?.poNumber ? [{
//           name: "PO Number",
//           value: order.poNumber,
//         }] : undefined,
//       pending_invoice_items_behavior: 'include',

//     });

//     // await stripe.invoices.update(invoice.id, {
//     //   number: `INV-000${order?.id}`,
//     // });

//     // const session = await stripe.checkout.sessions.create({
//     //   payment_method_types: ['card', 'us_bank_account'], // Apple Pay & GPay are covered by 'card'
//     //   line_items: [{
//     //     price_data: {
//     //       currency: 'usd',
//     //       product_data: {
//     //         name: 'Your Product',
//     //       },
//     //       unit_amount: 1000,
//     //     },
//     //     quantity: 1,
//     //   }],
//     //   mode: 'payment',
//     //   customer: order?.stripeCustomerId,
//     //   success_url: 'https://google.com',
//     //   cancel_url: 'https://youtube.com',
//     // });

//     // Step 3: Finalize the invoice
//     console.log("🚀 ~ order?.connectAccountId:", order?.connectAccountId)

//     const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

//     const originalPiId = finalizedInvoice.payment_intent;
//     await stripe.paymentIntents.cancel(originalPiId);

//      const newPaymentIntent = await stripe.paymentIntents.create({
//         amount: convertToCents(order.totalBill), // $120 in cents
//         currency: 'usd',
//         customer: order?.stripeCustomerId,
//         confirm: true,
//         application_fee_amount: convertToCents(order.adminReceivableAmount), // e.g. $90
//         transfer_data: {
//           destination: order.connectAccountId // local partner
//         },
//         automatic_payment_methods: { enabled: true }
//       });

//     await stripe.invoices.pay(invoice.id, {
//       payment_intent: newPaymentIntent.id
//     });

//     return {
//       invoiceId: finalizedInvoice?.id,
//       hostedInvoiceUrl: finalizedInvoice?.hosted_invoice_url,
//       invoicePdf: finalizedInvoice?.invoice_pdf,
//       status: finalizedInvoice?.status,
//       total: finalizedInvoice?.amount_due,
//     };

//   } catch (error) {
//     console.error('Invoice creation failed:', error);
//      throw new AppError(`${error?.message}`, 200)
//   }
// }

// async function createInvoiceWithItems({ order, currency = 'usd' }) {
//   console.log("🚀 ~ createInvoiceWithItems ~ order:", order.totalBill)
//   try {
//     const { items, shippingCharges, vat } = order;
//     let totalAmount = 0;
//     const line_items = [];

//     // Step 1: Create line items and calculate total
//     for (const item of items) {
//       const amount = parseFloat(item.price/item.qty);
//       totalAmount += amount;
//       line_items.push({
//         price_data: {
//           currency,
//           product_data: { name: item.product },
//           unit_amount: convertToCents(amount)
//         },
//         quantity: item.qty
//       });
//     }

//     if (shippingCharges && parseFloat(shippingCharges) > 0) {
//       totalAmount += parseFloat(shippingCharges);
//       line_items.push({
//         price_data: {
//           currency,
//           product_data: { name: 'Shipping Charges' },
//           unit_amount: convertToCents(shippingCharges)
//         },
//         quantity: 1
//       });
//     }

//     if (vat && parseFloat(vat) > 0) {
//       totalAmount += parseFloat(vat);
//       line_items.push({
//         price_data: {
//           currency,
//           product_data: { name: 'VAT' },
//           unit_amount: convertToCents(vat)
//         },
//         quantity: 1
//       });
//     }

//     const platformFeeInCents = convertToCents(order.adminReceivableAmount);
//     console.log("🚀 ~ createInvoiceWithItems ~ order.adminReceivableAmount:", order.adminReceivableAmount)

//     // Step 2: Create Checkout Session with split
//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ['card'],
//       mode: 'payment',
//       line_items,
//       success_url: 'https://busybeancoffee.com/product?status=success',
//       cancel_url: 'https://busybeancoffee.com/product?status=cancel',

//       // No customer passed (Stripe auto-creates one in connected account)
//       // No application_fee
//       // No transfer_data

//       metadata: {
//         orderId: order.id,
//         partnerId: order.connectAccountId,
//         salesRepId: order.salesRepId,
//       },
//     }, {
//       stripeAccount: order.connectAccountId, // ✅ tells Stripe to act on behalf of partner
//     });

//     return {
//       invoiceId: session.id,
//       hostedInvoiceUrl: session.url,
//       invoicePdf:""
//     };
//   } catch (error) {
//     console.error('❌ Checkout Session creation failed:', error);
//     throw new Error(error.message);
//   }
// }

async function createInvoiceWithItems({ order, currency = 'usd' }) {
  console.log('🚀 ~ createInvoiceWithItems ~ order:', order.totalBill);
  try {
    const { items, shippingCharges, vat } = order;
    let totalAmount = 0;
    const line_items = [];

    // Step 1: Create line items and calculate total
    for (const item of items) {
      const amount = parseFloat(item.price / item.qty);
      totalAmount += amount;
      line_items.push({
        price_data: {
          currency,
          product_data: { name: item.product || item.productName },
          unit_amount: convertToCents(amount),
        },
        quantity: item.qty,
      });
    }

    if (shippingCharges && parseFloat(shippingCharges) > 0) {
      totalAmount += parseFloat(shippingCharges);
      line_items.push({
        price_data: {
          currency,
          product_data: { name: 'Shipping Charges' },
          unit_amount: convertToCents(shippingCharges),
        },
        quantity: 1,
      });
    }

    if (vat && parseFloat(vat) > 0) {
      totalAmount += parseFloat(vat);
      line_items.push({
        price_data: {
          currency,
          product_data: { name: 'VAT' },
          unit_amount: convertToCents(vat),
        },
        quantity: 1,
      });
    }

    const platformFeeInCents = convertToCents(order.adminReceivableAmount || 0);
    const stripeFee = estimateStripeFeeFromDollars(order.totalBill);
    const stripeFeeInCents = convertToCents(stripeFee);

    const adminProfitCents = platformFeeInCents + stripeFeeInCents;

    // Step 2: Base Checkout Session
    const input = {
      payment_method_types: ['card'],
      mode: 'payment',
      customer: order?.stripeCustomerId,
      line_items,
      success_url: 'https://www.busybeancoffee.com/product?status=success',
      cancel_url: `https://www.busybeancoffee.com/product?status=cancel`,
      saved_payment_method_options: {
        payment_method_save: 'enabled',
      },
      // Always include metadata & description
      payment_intent_data: {
        description: `Payment for invoice ${order?.invoiceNumber}.`,
        metadata: {
          orderId: order?.id,
          invoiceNumber: order?.invoiceNumber || '',
          partnerId: order?.connectAccountId || '',
          salesRepId: order?.salesRepId || '',
          type: `checkout-session`,
          platform: `Busy Bean Coffee Inc.`,
        },
      },
    };

    // Add transfer logic if connectAccountId exists
    if (order.connectAccountId) {
      input.payment_intent_data.application_fee_amount = adminProfitCents;
      input.payment_intent_data.transfer_data = {
        destination: order.connectAccountId,
      };
      input.payment_intent_data.setup_future_usage = 'off_session';
    }

    const session = await stripe.checkout.sessions.create(input);

    return {
      invoiceId: session.id,
      hostedInvoiceUrl: session.url,
      proportionalStripeFee: stripeFee,
      invoicePdf: '',
    };
  } catch (error) {
    console.error('❌ Checkout Session creation failed:', error);
    throw new Error(error.message);
  }
}

async function transferToLocalPatners({
  amount,
  localPartnerAccountId,
  orderId,
  invoiceId,
  paymentIntentId,
}) {
  try {
    // Step 1: Retrieve the invoice if provided
    const invoice = invoiceId
      ? await stripe.invoices.retrieve(invoiceId)
      : null;
    console.log('🚀 ~ transferToLocalPatners ~ invoice:', invoice);
    const piId = invoice ? invoice?.payment_intent : paymentIntentId;

    if (!piId) throw new Error('No valid PaymentIntent ID found.');

    // Step 2: Retrieve PaymentIntent with expanded charges
    const paymentIntent = await stripe.paymentIntents.retrieve(piId, {
      expand: ['charges'],
    });

    console.log('🚀 ~ transferToLocalPatners ~ paymentIntent:', paymentIntent);

    // Step 3: Retrieve the charge (either from expanded charges or using latest_charge fallback)
    let charge;
    if (paymentIntent?.charges?.data?.length) {
      charge = paymentIntent.charges.data[0];
    } else if (paymentIntent?.latest_charge) {
      charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
    } else {
      throw new Error('No charge found in PaymentIntent');
    }

    // Step 4: Retrieve the balance transaction to get Stripe fee
    const balanceTransaction = await stripe.balanceTransactions.retrieve(
      charge.balance_transaction,
    );

    // Step 5: Stripe values are in cents
    const totalAmountCents = balanceTransaction.amount;
    console.log(
      '🚀 ~ transferToLocalPatners ~ totalAmountCents:',
      totalAmountCents,
    );
    const stripeFeeCents = balanceTransaction.fee;
    console.log(
      '🚀 ~ transferToLocalPatners ~ stripeFeeCents:',
      stripeFeeCents,
    );

    // Step 6: Convert commission amount to cents
    const commissionCents = convertToCents(amount);
    console.log('🚀 ~ transferToLocalPatners ~ amount:', amount);
    console.log(
      '🚀 ~ transferToLocalPatners ~ commissionCents:',
      commissionCents,
    );

    // Step 7: Calculate proportional Stripe fee
    const proportionalStripeFee = stripeFeeCents;
    console.log(
      '🚀 ~ transferToLocalPatners ~ proportionalStripeFee:',
      proportionalStripeFee,
    );

    // Step 8: Calculate net partner amount
    const netPartnerAmount = commissionCents - proportionalStripeFee;
    console.log(
      '🚀 ~ transferToLocalPatners ~ netPartnerAmount:',
      netPartnerAmount,
    );

    // Step 9: Create description for audit/debug
    const description = `For ${orderId} Partner Commission: $${(commissionCents / 100).toFixed(2)} - Stripe Fee: $${(proportionalStripeFee / 100).toFixed(2)} = Net: $${(netPartnerAmount / 100).toFixed(2)}`;

    // Step 10: Create the transfer
    const transfer = await stripe.transfers.create({
      amount: netPartnerAmount,
      currency: 'usd',
      destination: localPartnerAccountId,
      transfer_group: invoice?.id || undefined,
      description,
    });

    return {
      transfer,
      netPartnerAmount: netPartnerAmount / 100,
      proportionalStripeFee: proportionalStripeFee / 100,
    };
  } catch (error) {
    console.error('Transfer to local partner failed:', error);
    throw new AppError(`${error?.message}`, 200);
  }
}

async function getInvoiceDetails({ invoiceId }) {
  console.log('🚀 ~ getInvoiceDetails ~ getInvoiceDetails:');
  try {
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
    throw new AppError(`${error?.message}`, 200);
  }
}

async function retrieveConnectAccount({ accountId }) {
  try {
    const account = await stripe.accounts.retrieve(accountId);

    // Check if the account can handle payouts
    if (!account.payouts_enabled) {
      throw new AppError('Payouts are not enabled for this account.', 400);
    }
    // Check if the account can handle charges
    if (!account.charges_enabled) {
      throw new AppError('Charges are not enabled for this account.', 400);
    }

    // Check if the account details have been fully submitted
    if (!account.details_submitted) {
      throw new AppError('Account details are not fully submitted.', 400);
    }

    // Check if there are any requirements pending (errors or verification)
    if (
      account?.requirements?.errors?.length > 0 ||
      account?.requirements?.pending_verification?.length > 0
    ) {
      throw new AppError(
        'There are pending verification or requirements errors.',
        400,
      );
    }

    // If all checks pass, return the account information
    // console.log('🚀 ~ retrieveConnectAccount ~ account:', account);
    return account;
  } catch (error) {
    console.error(error);
    throw new AppError(`${error.message}`, 400); // Customize error message if necessary
  }
}

async function createStripeLoginLink({ accountId }) {
  try {
    const loginLink = await stripe.accounts.createLoginLink(accountId);
    return loginLink.url;
  } catch (error) {
    console.error('++++++++++++++++Error creating login link:', error);
    return null;
  }
}

async function pullAmountPaymentIntentFromBankAccount({
  amount,
  savedPaymentMethodId,
  customerId,
  orders = [],
  invoiceNumbers = [],
  partner,
}) {
  try {
    const cents = convertToCents(amount);
    console.log(
      '🚀 ~ pullAmountPaymentIntentFromBankAccount ~ amount:',
      amount,
    );

    const metadata = {
      platform: 'Busy Beans Coffee Inc.',
      localPatner: partner?.srName || '',
      territoryName: partner?.territoryName || '',
      message: 'Payment for these orders has been pulled out',
      type: 'bank-pullout',
      orders: orders.map((id) => `#${id}`).join(', '),
      invoices: invoiceNumbers.map((invoice) => `${invoice}`).join(', '),
    };
    console.log(
      '🚀 ~ pullAmountPaymentIntentFromBankAccount ~ metadata:',
      metadata,
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: cents,
      currency: 'usd',
      customer: customerId,
      payment_method: savedPaymentMethodId,
      statement_descriptor: 'BUSYBEANCOFFEE',
      description: `Payment pulled for invoices ${metadata.invoices}`,
      payment_method_types: ['us_bank_account'],
      off_session: true,
      confirm: true,
      metadata,
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status, // likely "processing"
    };
  } catch (error) {
    console.error('❌ ACH pull failed:', error);
    throw new AppError(`${error.message}`, 200);
  }
}

async function checkCheckoutSessionStatus(sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
    console.log('🚀 ~ checkCheckoutSessionStatus ~ session:', session);

    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const paymentStatus = session.payment_status;

    if (paymentStatus === 'paid') {
      return 'paid';
    }

    if (expiresAt < now) {
      return 'expired';
    }

    return 'open'; // Still within valid time, not paid yet
  } catch (err) {
    console.error('❌ Stripe error:', err.message);
    return 'unknown';
  }
}

async function blockCheckoutSession(sessionId) {
  try {
    await stripe.checkout.sessions.expire(sessionId);
    return true;
  } catch (err) {
    console.error('❌ Stripe error:', err.message);
  }
}

async function cards(customerId) {
  try {
    const paymentMethods = await stripe.customers.listPaymentMethods(
      customerId,
      { type: 'card' },
    );
    return paymentMethods;
  } catch (error) {
    throw new AppError(`${error.message} `, 200);
  }
}

async function deleteConnectAccount(connectAccountId) {
  try {
    const account = await stripe.accounts.del(connectAccountId);
    return account;
  } catch (error) {
    throw new AppError(`${error.message} `, 200);
  }
}
module.exports = {
  deleteConnectAccount,
  blockCheckoutSession,
  cards,
  checkCheckoutSessionStatus,
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
  getInvoiceDetails,
  createStandardConnectAccount,
};
// sessionCheckoutPaymnet --- check payment destination
// sessionCheckoutPaymnet --- check payment destination
