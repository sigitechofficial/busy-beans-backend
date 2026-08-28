# Subscription Webhook Handler Implementation

## Overview

A comprehensive webhook handler has been created to manage Stripe subscription events and keep the database in sync with Stripe's subscription state.

## Files Created/Modified

### 1. New File: `controllers/webhook/subscriptionWebhookController.js`

- Handles all subscription-related Stripe webhook events
- Updates subscription status, periods, and cancellation dates
- Manages subscription lifecycle events

### 2. Modified: `controllers/webhook/webhookController.js`

- Integrated subscription webhook handling
- Routes subscription events to the new handler

## Supported Webhook Events

### Subscription Lifecycle Events

1. **`customer.subscription.created`**

   - Triggered when a new subscription is created in Stripe
   - Updates: `status`, `currentPeriodStart`, `currentPeriodEnd`

2. **`customer.subscription.updated`**

   - Triggered when subscription details change (status, payment method, etc.)
   - Updates: `status`, `currentPeriodStart`, `currentPeriodEnd`, `canceledAt`
   - Handles reactivation (when `cancel_at_period_end` becomes false)

3. **`customer.subscription.deleted`**
   - Triggered when subscription is permanently deleted
   - Updates: `status` to "canceled", sets `canceledAt`

### Invoice Events

4. **`invoice.payment_succeeded`**

   - Triggered when a subscription invoice payment succeeds
   - Updates: `status`, `currentPeriodStart`, `currentPeriodEnd`
   - Only processes subscription invoices (not one-time payments)

5. **`invoice.payment_failed`**

   - Triggered when a subscription invoice payment fails
   - Updates: `status` to "past_due"
   - TODO: Add email notification for failed payments

6. **`invoice.upcoming`**
   - Triggered 7 days before next billing
   - TODO: Add email reminder functionality

### Payment Intent Events

7. **`payment_intent.succeeded`**

   - Triggered when payment intent succeeds (e.g., 3D Secure confirmation)
   - Updates subscription status if payment is for a subscription invoice

8. **`payment_intent.payment_failed`**
   - Triggered when payment intent fails
   - Updates: `status` to "incomplete"
   - TODO: Add email notification

### Trial Events

9. **`customer.subscription.trial_will_end`**
   - Triggered 3 days before trial ends
   - Updates subscription status
   - TODO: Add email reminder functionality

## Database Updates

The webhook handler updates the following subscription fields:

- **`status`**: Synced with Stripe subscription status

  - Values: `active`, `canceled`, `past_due`, `incomplete`, `trialing`, `pending_payment`

- **`currentPeriodStart`**: Start of current billing period (from Stripe)

- **`currentPeriodEnd`**: End of current billing period (from Stripe)

- **`canceledAt`**:
  - Set when subscription is canceled
  - Cleared when subscription is reactivated

## Error Handling

- All webhook handlers are wrapped in try-catch blocks
- Errors are logged but don't prevent webhook acknowledgment
- Webhook always returns success to Stripe to prevent retries
- Errors are logged for manual investigation

## Integration

The subscription webhook handler is integrated into the existing webhook flow:

1. Stripe sends webhook to `/api/webhooks/busy-beans-coffee`
2. `webhookController.js` verifies signature and routes events
3. Subscription events are routed to `subscriptionWebhookController.js`
4. Handler updates database accordingly
5. Success response sent to Stripe

## Future Enhancements (TODOs)

1. **Email Notifications**:

   - Failed payment notifications
   - Upcoming invoice reminders
   - Trial ending reminders

2. **Additional Events**:

   - `customer.subscription.paused`
   - `customer.subscription.resumed`
   - `invoice.created`
   - `invoice.finalized`

3. **Analytics**:
   - Track subscription lifecycle events
   - Monitor payment failures
   - Subscription health metrics

## Testing

To test the webhook handler:

1. Use Stripe CLI to forward webhooks:

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/busy-beans-coffee
   ```

2. Trigger test events:

   ```bash
   stripe trigger customer.subscription.created
   stripe trigger customer.subscription.updated
   stripe trigger invoice.payment_succeeded
   ```

3. Verify database updates in your subscription table

## Important Notes

- **Idempotency**: Webhook handlers are designed to be idempotent (safe to retry)
- **Database Lookup**: Subscriptions are found by `stripeSubscriptionId`
- **Status Sync**: Subscription status is always synced from Stripe (source of truth)
- **Error Recovery**: If subscription not found, event is logged but doesn't fail

## Webhook Configuration in Stripe Dashboard

Ensure these events are enabled in your Stripe webhook endpoint:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `invoice.upcoming`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
