# Frontend AI Agent Prompt - Subscription Payment Integration

## Task

Implement subscription payment handling in the frontend using Stripe.js that correctly handles both PaymentIntent (3D Secure) and SetupIntent (payment method collection) flows based on the backend API response.

## API Endpoint

**GET/POST** `/api/v1/users/subscription/:id/create-payment-intent/:userId?paymentMethodId=pm_xxx`

## Response Structure & Handling

### Key Decision Logic:

1. **If `response.isPaymentIntent === true`** → Use `stripe.confirmPayment()` with `response.clientSecret`
2. **If `response.setupIntentClientSecret` exists** → Use `stripe.confirmSetup()` with `response.setupIntentClientSecret`
3. **If `response.status === 'active'`** → Payment already succeeded, no action needed

### Response Examples:

**3D Secure Required (PaymentIntent):**

```json
{
  "success": true,
  "clientSecret": "pi_xxx_secret_xxx",
  "isPaymentIntent": true,
  "setupIntentClientSecret": undefined,
  "status": "incomplete",
  "requiresAction": true
}
```

→ Use: `stripe.confirmPayment({ clientSecret, confirmParams: {} })`

**Payment Method Collection (SetupIntent):**

```json
{
  "success": true,
  "setupIntentClientSecret": "seti_xxx_secret_xxx",
  "isPaymentIntent": false,
  "clientSecret": undefined,
  "requiresPaymentMethod": true
}
```

→ Use: `stripe.confirmSetup({ clientSecret: setupIntentClientSecret, confirmParams: {} })`

**Payment Succeeded:**

```json
{
  "success": true,
  "status": "active",
  "message": "Subscription created and payment processed successfully!"
}
```

→ No action needed, show success message

## Implementation Requirements

1. **Check `isPaymentIntent` field first** to determine which Stripe method to use
2. **Never use `confirmSetup()` when `isPaymentIntent === true`**
3. **Never use `confirmPayment()` when `isPaymentIntent === false`**
4. **After successful payment**, call `POST /api/v1/users/subscription/:id/confirm-payment` to sync status
5. **Handle payment statuses**: `succeeded`, `requires_capture`, `processing` all indicate success
6. **Error handling**: Handle `StripeCardError`, `StripeAuthenticationError`, and other Stripe errors

## Code Pattern

```javascript
const response = await fetch(
  `/api/v1/users/subscription/${id}/create-payment-intent/${userId}?paymentMethodId=${pmId}`
);

if (response.isPaymentIntent === true) {
  // PaymentIntent flow - 3D Secure
  // IMPORTANT: Check hasPaymentMethod field first!

  if (response.hasPaymentMethod === true) {
    // Payment method already attached - just confirm 3D Secure
    // NO payment sheet, NO card entry - just 3D Secure popup
    const result = await stripe.confirmPayment({
      clientSecret: response.clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/subscription-success`,
      },
      redirect: "if_required", // Only redirect if 3D Secure popup needed
    });
  } else {
    // No payment method - show Payment Element to collect card
    const elements = stripe.elements({
      clientSecret: response.clientSecret,
      appearance: { theme: "stripe" },
    });

    const paymentElement = elements.create("payment");
    paymentElement.mount("#payment-element");

    // When user submits form
    const result = await stripe.confirmPayment({
      elements,
      clientSecret: response.clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/subscription-success`,
      },
      redirect: "if_required", // Only redirect if 3D Secure popup needed
    });
  }

  if (
    ["succeeded", "requires_capture", "processing"].includes(
      result.paymentIntent.status
    )
  ) {
    await syncStatus(id); // POST /api/v1/users/subscription/:id/confirm-payment
  }
} else if (response.setupIntentClientSecret) {
  // SetupIntent flow - Collect card
  const result = await stripe.confirmSetup({
    clientSecret: response.setupIntentClientSecret,
    confirmParams: {},
  });
  if (result.setupIntent.status === "succeeded") {
    // Retry API call with paymentMethodId from result
    await processPayment(id, userId, result.setupIntent.payment_method);
  }
}
```

## Critical Rules

- ✅ `isPaymentIntent: true` → `stripe.confirmPayment()`
- ✅ `isPaymentIntent: false` OR `setupIntentClientSecret` exists → `stripe.confirmSetup()`
- ✅ Always sync status after successful payment confirmation
- ❌ DO NOT mix up confirmPayment and confirmSetup methods
