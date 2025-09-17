const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env;
const stripe = require('stripe')(STRIPE_SECRET_KEY);
const Stripe = require('../stripe');
const {
  user,
  salesRep,
  transfersToSalesRep,
  item,
  order,
} = require('../../models');
const { parseOrderString } = require('../../utils/webhookHelpersFunctions');
const {
  paidInvoiceEmailEvent,
  paidInvoiceAdminOrLocalPatnerEvent,
  paidInvoiceAdminOrLocalPatnerEventAndCustomer,
} = require('../events/paymentInvoicePaidEvent');
const { Op, literal } = require('sequelize');

const endpointSecret = `whsec_9M5iAefqoU2A9GvmGcpwIgolrldMsZ2P`; //LIVE
// const endpointSecret = `whsec_PgzwORQviUKawaKDIXDeRbSSHINHQRik`; //SANDBOX
exports.stripeSubscriptionWebhookEventHandler = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  console.log(
    'ЁЯЪА ~~~~~~~~~~~ exportts.sripeSubscriptionWebhookEventHandler= ~ event:',
  );
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log(
      'ЁЯЪА ~~~~~~~~~~~ exports.stripeSubscriptionWebhookEventHandler= ~ event:',
      JSON.stringify(event),
    );
  } catch (err) {
    console.error(
      'тЪая╕ПтЪая╕ПтЪая╕П Webhook signature verification failed.',
      err.message,
    );
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('ЁЯЪАЁЯЪАЁЯЪА ~~~~~~~~~~ >  EVENT TYPE }:', event.type);
  switch (event.type) {
    case 'checkout.session.completed':
      await invoicePaid(event);
      break;
    case 'invoice.paid': //not needed yet  "_" add underscore to prevent tranfers for now
      await invoicePaid(event);
      break;
    case 'payment_intent.succeeded': //not needed yet  "_" add underscore to prevent tranfers for now
      await onPaymentIntentSucceeded(event);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};
const invoicePaid = async (event) => {
  try {
    const invoice = event.data.object;
    const localPartnerId = invoice.metadata?.salesRepId;
    let localPatnerAccount = invoice.metadata?.localPatnerAccount;
    const orderId = invoice.metadata?.orderId;
    const condition = { invoiceId: invoice?.id };
    if (orderId) condition.id = orderId;

    console.log('🚀 ~ invoicePaid ~ orderId:', condition);
    const orderPlaced = await order.findOne({
      where: condition,
      attributes: [
        'id',
        [
          literal(`COALESCE(
             (SELECT SUM(salerCommission)
              FROM items
              WHERE items.orderId = order.id ), 0)`),
          'totalSalerCommission',
        ],
        [
          literal(`
            COALESCE(order.totalBill, 0) - COALESCE((
              SELECT SUM(salerCommission)
              FROM items
              WHERE items.orderId = order.id
            ), 0)
          `),
          'adminEarnings',
        ],
      ],
      raw: true,
    });
    console.log('🚀 ~ invoicePaid ~ orderId:', orderPlaced);
    await order.update(
      {
        paymentMethod: 'card',
        localPatnerCommission: orderPlaced?.totalSalerCommission,
        adminReceivableAmount: orderPlaced?.adminEarnings,
        adminReceivableStatus: true,
        paymentStatus: 'done',
        invoicePaidDate: Date.now(),
        pulloutDate: Date.now(),
        paymentIntentId: invoice.payment_intent,
      },
      { where: { id: orderPlaced?.id } },
    );

    paidInvoiceAdminOrLocalPatnerEventAndCustomer({ orderId: orderPlaced?.id });
    // paidInvoiceAdminOrLocalPatnerEvent({ orderId });
    //   if(!localPartnerId) {
    //   return true
    //   }

    //   const srAccount = await salesRep.findOne({where:{id:localPartnerId}})
    //   localPatnerAccount = srAccount?.connectAccountId
    //  if(localPatnerAccount){
    //      console.log(
    //       'ЁЯЪА ~~~~~ localPatnerAccount ~ event:',
    //       localPatnerAccount,
    //     )
    //     const totalWholesalePrice = await item.sum('salerCommission', {
    //       where: {
    //         orderId: orderId,
    //       },
    //     });
    //     console.log(
    //       'ЁЯЪА ~~~~~ localPatnerAccount ~ event:',
    //       totalWholesalePrice,
    //     )
    //       const transfer =  await Stripe.transferToLocalPatners({amount:totalWholesalePrice,localPartnerAccountId:localPatnerAccount,invoice})

    //       await transfersToSalesRep.create({
    //         amount: totalWholesalePrice, // as string, e.g. cents in USD
    //         tranferId: transfer?.id, // Stripe transfer ID
    //         salesRepId:localPartnerId,
    //         orderId:orderId
    //       });
    //       await order.update({paymentStatus:'done',localPatnerCommission:totalWholesalePrice},{where:{orderId}})
    //   }

    const session = event.data.object;

    // Expand to get the PaymentIntent
    const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
      expand: ['charges'],
    });

    const platformChargeId = pi.latest_charge || pi.charges?.data?.[0]?.id;
    if (!platformChargeId) return;

    // Retrieve platform charge with transfer expanded
    const platformCharge = await stripe.charges.retrieve(platformChargeId, {
      expand: ['transfer'],
    });

    const transferId =
      typeof platformCharge.transfer === 'string'
        ? platformCharge.transfer
        : platformCharge.transfer?.id;

    if (!transferId) return;

    // Get transfer to find connected account + destination payment
    const transfer = await stripe.transfers.retrieve(transferId);
    const connectedAccountId = transfer?.destination; // acct_xxx
    const destinationPaymentId = transfer?.destination_payment; // ch_xxx or py_xxx

    if (connectedAccountId && destinationPaymentId) {
      await stripe.charges.update(
        destinationPaymentId,
        {
          description: `Payment for invoice ${pi.metadata?.invoiceNumber || ''} — Busy Bean Coffee Inc.`,
          metadata: {
            orderId: pi.metadata?.orderId || '',
            invoiceNumber: pi.metadata?.invoiceNumber || '',
            partnerId: pi.metadata?.partnerId || '',
            salesRepId: pi.metadata?.salesRepId || '',
            type: pi.metadata?.type || 'checkout-session',
            platform: pi.metadata?.platform || 'Busy Bean Coffee Inc.',
          },
        },
        { stripeAccount: connectedAccountId }, // apply update on connected account
      );
    }

    return true;
  } catch (error) {
    console.error('Error handling invoice.paid:', error);
  }
};

// assuming: const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const onPaymentIntentSucceeded = async (event) => {
  const pi = event.data.object;

  // grab the platform charge id
  const platformChargeId = pi.latest_charge || pi.charges?.data?.[0]?.id;
  if (!platformChargeId) return;

  // retrieve platform charge with transfer expanded
  const platformCharge = await stripe.charges.retrieve(platformChargeId, {
    expand: ['transfer'],
  });

  const transferId =
    typeof platformCharge.transfer === 'string'
      ? platformCharge.transfer
      : platformCharge.transfer?.id;

  if (!transferId) return;

  // get transfer to find connected account + destination payment
  const transfer = await stripe.transfers.retrieve(transferId);
  const connectedAccountId = transfer?.destination; // acct_xxx
  const destinationPaymentId = transfer?.destination_payment; // ch_xxx or py_xxx

  if (connectedAccountId && destinationPaymentId) {
    await stripe.charges.update(
      destinationPaymentId,
      {
        description: `Payment for invoice ${pi.metadata?.invoiceNumber || ''} — Busy Bean Coffee Inc.`,
        metadata: {
          orderId: pi.metadata?.orderId || '',
          invoiceNumber: pi.metadata?.invoiceNumber || '',
          partnerId: pi.metadata?.partnerId || '',
          salesRepId: pi.metadata?.salesRepId || '',
          type: pi.metadata?.type || 'checkout-session',
          platform: pi.metadata?.platform || 'Busy Bean Coffee Inc.',
        },
      },
      { stripeAccount: connectedAccountId }, // apply update on the connected account
    );
  }
};

const paymentMethodAttch = async (event) => {
  try {
    const paymentMethod = event.data.object;
    const customerId = paymentMethod.customer;
    await user.update(
      { defaultPaymentMethod: paymentMethod?.id },
      { stripeCustomerId: customerId },
    );
    return true;
  } catch (error) {
    console.error('Error handling payment_method.attached:', error);
    return false;
  }
};
