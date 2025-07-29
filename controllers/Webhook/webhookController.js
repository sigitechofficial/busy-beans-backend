const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env;
const stripe = require('stripe')(STRIPE_SECRET_KEY);
const Stripe = require('../stripe');
const { user, salesRep, transfersToSalesRep, item } = require('../../models');
const { order } = require('../../models');
const { paidInvoiceEmailEvent,paidInvoiceAdminOrLocalPatnerEvent } = require('../events/paymentInvoicePaidEvent');

const endpointSecret = `whsec_9YDoVbh7hFbMrPZVHvVesbCycZ2GZNa8`; //LIVE
// const endpointSecret = `whsec_1Xqm67Agpa70u6fqQt85NergNgJmsQAN` //SANDBOX
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
    console.log('🚀 ~ invoicePaid ~ orderId:', orderId);

    await order.update(
      { paymentMethod: 'card', paymentStatus: 'done' },
      { where: { id: orderId } },
    );

    paidInvoiceEmailEvent({orderId})
    paidInvoiceAdminOrLocalPatnerEvent({orderId})
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
    return true;
  } catch (error) {
    console.error('Error handling invoice.paid:', error);
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
