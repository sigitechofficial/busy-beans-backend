const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env;
const stripe = require("stripe")(STRIPE_SECRET_KEY);
const Stripe = require("../stripe");
const {
  user,
  salesRep,
  transfersToSalesRep,
  item,
  order,
} = require("../../models");
const { parseOrderString } = require("../../utils/webhookHelpersFunctions");
const {
  paidInvoiceEmailEvent,
  paidInvoiceAdminOrLocalPatnerEvent,
  paidInvoiceAdminOrLocalPatnerEventAndCustomer,
} = require("../events/paymentInvoicePaidEvent");
const { Op, literal } = require("sequelize");

const endpointSecret = `whsec_9M5iAefqoU2A9GvmGcpwIgolrldMsZ2P`; //LIVE
// const endpointSecret = `whsec_PgzwORQviUKawaKDIXDeRbSSHINHQRik`; //SANDBOX
exports.stripeSubscriptionWebhookEventHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  console.log(
    "ЁЯЪА ~~~~~~~~~~~ exportts.sripeSubscriptionWebhookEventHandler= ~ event:"
  );
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log(
      "ЁЯЪА ~~~~~~~~~~~ exports.stripeSubscriptionWebhookEventHandler= ~ event:",
      JSON.stringify(event)
    );
  } catch (err) {
    console.error(
      "тЪая╕ПтЪая╕ПтЪая╕П Webhook signature verification failed.",
      err.message
    );
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("ЁЯЪАЁЯЪАЁЯЪА ~~~~~~~~~~ >  EVENT TYPE }:", event.type);
  switch (event.type) {
    case "checkout.session.completed":
      await invoicePaid(event);
      break;
    case "invoice.paid": //not needed yet  "_" add underscore to prevent tranfers for now
      await invoicePaid(event);
      break;
    case "payment_intent.succeeded": //not needed yet  "_" add underscore to prevent tranfers for now
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

    console.log("🚀 ~ invoicePaid ~ orderId:", condition);
    const orderPlaced = await order.findOne({
      where: condition,
      attributes: [
        "id",
        [
          literal(`COALESCE(
             (SELECT SUM(salerCommission)
              FROM items
              WHERE items.orderId = order.id ), 0)`),
          "totalSalerCommission",
        ],
        [
          literal(`
            COALESCE(order.totalBill, 0) - COALESCE((
              SELECT SUM(salerCommission)
              FROM items
              WHERE items.orderId = order.id
            ), 0)
          `),
          "adminEarnings",
        ],
      ],
      raw: true,
    });
    console.log("🚀 ~ invoicePaid ~ orderId:", orderPlaced);
    await order.update(
      {
        paymentMethod: "card",
        localPatnerCommission: orderPlaced?.totalSalerCommission,
        adminReceivableAmount: orderPlaced?.adminEarnings,
        adminReceivableStatus: true,
        paymentStatus: "done",
        invoicePaidDate: Date.now(),
        pulloutDate: Date.now(),
        paymentIntentId: invoice.payment_intent,
      },
      { where: { id: orderPlaced?.id } }
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

    // Expand to get the PaymentIntent + charges
    const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
      expand: ["charges"],
    });

    // platform charge id from the PaymentIntent
    const platformChargeId = pi.latest_charge || pi.charges?.data?.[0]?.id;
    if (!platformChargeId) return;

    // Retrieve the platform charge with transfer + balance_transaction expanded
    const platformCharge = await stripe.charges.retrieve(platformChargeId, {
      expand: ["transfer", "balance_transaction"],
    });

    const transferId =
      typeof platformCharge.transfer === "string"
        ? platformCharge.transfer
        : platformCharge.transfer?.id;

    if (!transferId) return;

    // Read Stripe fee from the platform charge's balance transaction
    const bt = platformCharge.balance_transaction;
    const feeMinor = typeof bt === "object" ? bt.fee : null; // integer in minor units (e.g., cents)
    const feeCurrency = (
      typeof bt === "object" ? bt.currency : pi.currency || "usd"
    )?.toLowerCase();

    // Format fee for description (handles common zero-decimal currencies)
    const zeroDecimal = new Set([
      "bif",
      "clp",
      "djf",
      "gnf",
      "jpy",
      "kmf",
      "krw",
      "mga",
      "pyg",
      "rwf",
      "ugx",
      "vnd",
      "vuv",
      "xaf",
      "xof",
      "xpf",
    ]);
    const formatAmount = (minor, currency = "usd") => {
      if (typeof minor !== "number") return "";
      const amount = zeroDecimal.has(currency) ? minor : minor / 100;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
        minimumFractionDigits: zeroDecimal.has(currency) ? 0 : 2,
        maximumFractionDigits: zeroDecimal.has(currency) ? 0 : 2,
      }).format(amount);
    };
    const feeText =
      feeMinor != null
        ? `, stripe fee ${formatAmount(feeMinor, feeCurrency)}`
        : "";

    // Get transfer to find connected account + destination payment
    const transfer = await stripe.transfers.retrieve(transferId);
    const connectedAccountId = transfer?.destination; // acct_xxx
    const destinationPaymentId = transfer?.destination_payment; // ch_xxx or py_xxx

    if (connectedAccountId && destinationPaymentId) {
      const invoiceNumber = pi.metadata?.invoiceNumber || "";
      const description = `Payment for invoice ${invoiceNumber}${feeText} — Busy Bean Coffee Inc.`;

      await stripe.charges.update(
        destinationPaymentId,
        {
          description,
          metadata: {
            orderId: pi.metadata?.orderId || "",
            invoiceNumber,
            partnerId: pi.metadata?.partnerId || "",
            salesRepId: pi.metadata?.salesRepId || "",
            type: pi.metadata?.type || "checkout-session",
            platform: pi.metadata?.platform || "Busy Bean Coffee Inc.",
            platform_charge_id: platformChargeId,
            platform_fee_minor: feeMinor ?? "",
            platform_fee_currency: (feeCurrency || "").toUpperCase(),
          },
        },
        { stripeAccount: connectedAccountId } // apply update on connected account
      );
    }

    return true;
  } catch (error) {
    console.error("Error handling invoice.paid:", error);
  }
};

// assuming: const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const onPaymentIntentSucceeded = async (event) => {
  const pi = event.data.object;

  // grab the platform charge id
  const platformChargeId = pi.latest_charge || pi.charges?.data?.[0]?.id;
  if (!platformChargeId) return;

  // retrieve platform charge with transfer + balance_transaction expanded
  const platformCharge = await stripe.charges.retrieve(platformChargeId, {
    expand: ["transfer", "balance_transaction"],
  });

  const transferId =
    typeof platformCharge.transfer === "string"
      ? platformCharge.transfer
      : platformCharge.transfer?.id;

  if (!transferId) return;

  // pull fee (in the platform's currency) from the balance transaction
  // fee is an integer in the smallest currency unit (e.g., cents)
  const bt = platformCharge.balance_transaction;
  const feeAmountMinor = typeof bt === "object" ? bt.fee : null; // e.g., 460 = $4.60
  const feeCurrency =
    typeof bt === "object" ? bt.currency : pi.currency || "usd";

  // simple currency formatter for the description
  const formatAmount = (minor, currency = "usd") => {
    if (typeof minor !== "number") return "";
    // assumes 2dp currencies (USD/EUR/etc.). For zero-decimal currencies you could branch on currency.
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(minor / 100);
  };

  const feeText =
    feeAmountMinor != null
      ? `, stripe fee ${formatAmount(feeAmountMinor, feeCurrency)}`
      : "";

  // get transfer to find connected account + destination payment
  const transfer = await stripe.transfers.retrieve(transferId);
  const connectedAccountId = transfer?.destination; // acct_xxx
  const destinationPaymentId = transfer?.destination_payment; // ch_xxx (usually)

  if (connectedAccountId && destinationPaymentId) {
    const invoiceNumber = pi.metadata?.invoiceNumber || "";
    const baseDesc = `Payment for invoice ${invoiceNumber}${feeText} — Busy Bean Coffee Inc.`;

    await stripe.charges.update(
      destinationPaymentId,
      {
        description: baseDesc,
        metadata: {
          orderId: pi.metadata?.orderId || "",
          invoiceNumber,
          partnerId: pi.metadata?.partnerId || "",
          salesRepId: pi.metadata?.salesRepId || "",
          type: pi.metadata?.type || "checkout-session",
          platform: pi.metadata?.platform || "Busy Bean Coffee Inc.",
          platform_charge_id: platformChargeId,
          platform_fee_minor: feeAmountMinor ?? "",
          platform_fee_currency: (feeCurrency || "").toUpperCase(),
        },
      },
      { stripeAccount: connectedAccountId } // apply update on the connected account
    );
  }
};

const paymentMethodAttch = async (event) => {
  try {
    const paymentMethod = event.data.object;
    const customerId = paymentMethod.customer;
    await user.update(
      { defaultPaymentMethod: paymentMethod?.id },
      { stripeCustomerId: customerId }
    );
    return true;
  } catch (error) {
    console.error("Error handling payment_method.attached:", error);
    return false;
  }
};
