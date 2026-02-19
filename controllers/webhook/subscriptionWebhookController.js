const { STRIPE_SECRET_KEY, STRIPE_SUBSCRIPTION_WEBHOOK_SECERET } = process.env;
const stripe = require("stripe")(STRIPE_SECRET_KEY);
const { subscription, user, coffeeMachine } = require("../../models");
const { Op } = require("sequelize");
const { subscriptionCancellationEmailEvent } = require("../events/subscriptionCancellationEvent");

const endpointSecret = `${STRIPE_SUBSCRIPTION_WEBHOOK_SECERET}`;

/**
 * Main webhook handler for Stripe subscription events
 * Handles all subscription-related webhook events from Stripe
 */
exports.handleSubscriptionWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log(
      "✅ Subscription Webhook Event Received:",
      event.type,
      event.id
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle different event types
  try {
    switch (event.type) {
      // Subscription lifecycle events
      case "customer.subscription.created":
        await handleSubscriptionCreated(event);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event);
        break;

      // Invoice events (for subscription payments)
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event);
        break;

      case "invoice.upcoming":
        await handleInvoiceUpcoming(event);
        break;

      // Note: payment_intent.succeeded is NOT handled here for subscriptions
      // because invoice.payment_succeeded already handles subscription payments
      // and both events fire for the same payment, causing duplicate processing.
      // payment_intent.succeeded is handled in webhookController.js for order payments only.

      // Trial events
      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(event);
        break;

      default:
        console.log(
          `⚠️ Unhandled subscription webhook event type: ${event.type}`
        );
    }

    // Always return success to Stripe
    res.json({ received: true });
  } catch (error) {
    console.error("❌ Error processing subscription webhook:", error);
    // Still return 200 to Stripe to prevent retries for processing errors
    res.status(200).json({
      received: true,
      error: error.message,
    });
  }
};

/**
 * Handle subscription.created event
 * When a new subscription is created in Stripe
 */
const handleSubscriptionCreated = async (event) => {
  const stripeSubscription = event.data.object;

  console.log(
    `📝 Processing subscription.created for: ${stripeSubscription.id}`
  );

  // Find subscription by stripeSubscriptionId
  const subscriptionRecord = await subscription.findOne({
    where: {
      stripeSubscriptionId: stripeSubscription.id,
    },
  });

  if (!subscriptionRecord) {
    console.warn(
      `⚠️ Subscription not found in database for Stripe subscription: ${stripeSubscription.id}`
    );
    return;
  }

  // Update subscription with Stripe data
  const updateData = {
    status: stripeSubscription.status,
    currentPeriodStart: new Date(
      stripeSubscription.current_period_start * 1000
    ),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
  };

  // Only update canceledAt if subscription is canceled
  if (stripeSubscription.canceled_at) {
    updateData.canceledAt = new Date(stripeSubscription.canceled_at * 1000);
  }

  await subscriptionRecord.update(updateData);

  console.log(
    `✅ Subscription ${subscriptionRecord.id} updated from subscription.created event`
  );
};

/**
 * Handle subscription.updated event
 * When subscription status, payment method, or other details change
 */
const handleSubscriptionUpdated = async (event) => {
  const stripeSubscription = event.data.object;

  console.log(
    `📝 Processing subscription.updated for: ${stripeSubscription.id}`
  );

  // Find subscription by stripeSubscriptionId
  const subscriptionRecord = await subscription.findOne({
    where: {
      stripeSubscriptionId: stripeSubscription.id,
    },
  });

  if (!subscriptionRecord) {
    console.warn(
      `⚠️ Subscription not found in database for Stripe subscription: ${stripeSubscription.id}`
    );
    return;
  }

  // Update subscription with latest Stripe data
  const updateData = {
    status: stripeSubscription.status,
    currentPeriodStart: new Date(
      stripeSubscription.current_period_start * 1000
    ),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
  };

  // Handle cancellation
  if (stripeSubscription.canceled_at) {
    updateData.canceledAt = new Date(stripeSubscription.canceled_at * 1000);
    // If cancel_at_period_end is false, subscription was reactivated
    if (!stripeSubscription.cancel_at_period_end) {
      updateData.canceledAt = null;
      updateData.status = "active";
    }
  } else {
    // If canceled_at is null, subscription is active
    updateData.canceledAt = null;
  }

  // Update status based on Stripe status
  if (
    stripeSubscription.status === "active" &&
    !stripeSubscription.cancel_at_period_end
  ) {
    updateData.status = "active";
    updateData.canceledAt = null;
  } else if (stripeSubscription.status === "canceled") {
    updateData.status = "canceled";
  } else if (stripeSubscription.status === "past_due") {
    updateData.status = "past_due";
  } else if (stripeSubscription.status === "incomplete") {
    updateData.status = "incomplete";
  } else if (stripeSubscription.status === "trialing") {
    updateData.status = "trialing";
  }

  await subscriptionRecord.update(updateData);

  console.log(
    `✅ Subscription ${subscriptionRecord.id} updated from subscription.updated event. Status: ${updateData.status}`
  );
};

/**
 * Handle subscription.deleted event
 * When subscription is permanently deleted in Stripe
 */
const handleSubscriptionDeleted = async (event) => {
  const stripeSubscription = event.data.object;

  console.log(
    `📝 Processing subscription.deleted for: ${stripeSubscription.id}`
  );

  // Find subscription by stripeSubscriptionId
  const subscriptionRecord = await subscription.findOne({
    where: {
      stripeSubscriptionId: stripeSubscription.id,
    },
  });

  if (!subscriptionRecord) {
    console.warn(
      `⚠️ Subscription not found in database for Stripe subscription: ${stripeSubscription.id}`
    );
    return;
  }

  // Update subscription status to canceled
  await subscriptionRecord.update({
    status: "canceled",
    canceledAt: new Date(),
  });

  // Send cancellation email (subscription already ended - no period end access)
  const periodEnd = stripeSubscription.current_period_end
    ? new Date(stripeSubscription.current_period_end * 1000)
    : null;
  subscriptionCancellationEmailEvent({
    customerEmail: subscriptionRecord.customerEmail,
    userName: subscriptionRecord.userName,
    periodEnd,
    cancelAtPeriodEnd: false,
  }).catch((err) => console.error("❌ Cancellation email failed:", err.message));

  console.log(
    `✅ Subscription ${subscriptionRecord.id} marked as canceled from subscription.deleted event`
  );
};

/**
 * Handle invoice.payment_succeeded event
 * When a subscription invoice payment succeeds
 */
const handleInvoicePaymentSucceeded = async (event) => {
  const invoice = event.data.object;

  // Only process subscription invoices
  if (!invoice.subscription) {
    console.log("ℹ️ Invoice is not for a subscription, skipping...");
    return;
  }

  console.log(
    `📝 Processing invoice.payment_succeeded for subscription: ${invoice.subscription}`
  );

  // Find subscription by stripeSubscriptionId
  const subscriptionRecord = await subscription.findOne({
    where: {
      stripeSubscriptionId: invoice.subscription,
    },
  });

  if (!subscriptionRecord) {
    console.warn(
      `⚠️ Subscription not found in database for Stripe subscription: ${invoice.subscription}`
    );
    return;
  }

  // Retrieve full subscription from Stripe to get latest status
  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(
      invoice.subscription
    );

    // Update subscription with latest data
    const updateData = {
      status: stripeSubscription.status,
      currentPeriodStart: new Date(
        stripeSubscription.current_period_start * 1000
      ),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    };

    // Clear canceledAt if subscription is active
    if (stripeSubscription.status === "active") {
      updateData.canceledAt = null;
    }

    await subscriptionRecord.update(updateData);

    console.log(
      `✅ Subscription ${subscriptionRecord.id} updated from invoice.payment_succeeded. Status: ${updateData.status}`
    );
  } catch (error) {
    console.error(
      `❌ Error retrieving subscription ${invoice.subscription}:`,
      error.message
    );
  }
};

/**
 * Handle invoice.payment_failed event
 * When a subscription invoice payment fails
 */
const handleInvoicePaymentFailed = async (event) => {
  const invoice = event.data.object;

  // Only process subscription invoices
  if (!invoice.subscription) {
    console.log("ℹ️ Invoice is not for a subscription, skipping...");
    return;
  }

  console.log(
    `📝 Processing invoice.payment_failed for subscription: ${invoice.subscription}`
  );

  // Find subscription by stripeSubscriptionId
  const subscriptionRecord = await subscription.findOne({
    where: {
      stripeSubscriptionId: invoice.subscription,
    },
  });

  if (!subscriptionRecord) {
    console.warn(
      `⚠️ Subscription not found in database for Stripe subscription: ${invoice.subscription}`
    );
    return;
  }

  // Retrieve full subscription from Stripe to get latest status
  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(
      invoice.subscription
    );

    // Update subscription status to past_due
    await subscriptionRecord.update({
      status: "past_due",
      // Keep current period dates as they are
    });

    console.log(
      `✅ Subscription ${subscriptionRecord.id} marked as past_due from invoice.payment_failed`
    );

    // TODO: Send notification email to customer about failed payment
    // You can add email notification logic here
  } catch (error) {
    console.error(
      `❌ Error retrieving subscription ${invoice.subscription}:`,
      error.message
    );
  }
};

/**
 * Handle invoice.upcoming event
 * When an invoice is about to be created (7 days before billing)
 * Useful for sending reminders
 */
const handleInvoiceUpcoming = async (event) => {
  const invoice = event.data.object;

  // Only process subscription invoices
  if (!invoice.subscription) {
    console.log("ℹ️ Invoice is not for a subscription, skipping...");
    return;
  }

  console.log(
    `📝 Processing invoice.upcoming for subscription: ${invoice.subscription}`
  );

  // Find subscription by stripeSubscriptionId
  const subscriptionRecord = await subscription.findOne({
    where: {
      stripeSubscriptionId: invoice.subscription,
    },
  });

  if (!subscriptionRecord) {
    console.warn(
      `⚠️ Subscription not found in database for Stripe subscription: ${invoice.subscription}`
    );
    return;
  }

  // TODO: Send upcoming invoice reminder email
  // You can add email notification logic here
  console.log(
    `ℹ️ Upcoming invoice for subscription ${subscriptionRecord.id}. Amount: ${invoice.amount_due / 100} ${invoice.currency.toUpperCase()}`
  );
};

// Removed handlePaymentIntentSucceeded and handlePaymentIntentFailed
// These handlers were causing duplicate processing because:
// 1. Both invoice.payment_succeeded and payment_intent.succeeded fire for the same subscription payment
// 2. Both handlers update the same fields (status, currentPeriodStart, currentPeriodEnd, canceledAt)
// 3. invoice.payment_succeeded is more reliable and specific for subscription payments
// 
// payment_intent events are still handled in webhookController.js for order payments only

/**
 * Handle customer.subscription.trial_will_end event
 * When a trial subscription is about to end (3 days before)
 */
const handleTrialWillEnd = async (event) => {
  const stripeSubscription = event.data.object;

  console.log(
    `📝 Processing trial_will_end for subscription: ${stripeSubscription.id}`
  );

  // Find subscription by stripeSubscriptionId
  const subscriptionRecord = await subscription.findOne({
    where: {
      stripeSubscriptionId: stripeSubscription.id,
    },
  });

  if (!subscriptionRecord) {
    console.warn(
      `⚠️ Subscription not found in database for Stripe subscription: ${stripeSubscription.id}`
    );
    return;
  }

  // Update subscription status
  await subscriptionRecord.update({
    status: stripeSubscription.status,
    currentPeriodStart: new Date(
      stripeSubscription.current_period_start * 1000
    ),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
  });

  // TODO: Send trial ending reminder email
  console.log(`ℹ️ Trial ending soon for subscription. ${subscriptionRecord.id}`);
};
