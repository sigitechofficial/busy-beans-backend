# Subscription Payment API - Frontend Integration Guide

## API Endpoint

**POST/GET** `/api/v1/users/subscription/:id/create-payment-intent/:userId`

## Overview

This API handles subscription payment creation with support for:

- **3D Secure authentication** (PaymentIntent flow)
- **Payment method collection** (SetupIntent flow)
- **Automatic payment processing** (when no 3D Secure required)

---

## Response Structure

The API returns different response structures based on the payment scenario:

### Scenario 1: 3D Secure Required (PaymentIntent)

**When:** Subscription requires 3D Secure authentication

```json
{
  "success": true,
  "subscriptionId": "uuid",
  "stripeSubscriptionId": "sub_xxx",
  "stripeCustomerId": "cus_xxx",
  "status": "incomplete",
  "clientSecret": "pi_xxx_secret_xxx",
  "isPaymentIntent": true,
  "hasPaymentMethod": true,
  "paymentMethodId": "pm_xxx",
  "setupIntentClientSecret": undefined,
  "requiresAction": true,
  "totalPrice": 99.99,
  "message": "Payment method found. 3D Secure authentication required. Use stripe.confirmPayment() with existing payment method - NO payment sheet needed."
}
```

**Frontend Action:**

**IMPORTANT: Check `hasPaymentMethod` field to determine flow**

### If `hasPaymentMethod === true` (Payment method already attached)

**Use `stripe.confirmPayment()` directly - NO payment sheet, just 3D Secure confirmation popup**

```javascript
// Payment method is already attached - just confirm 3D Secure
// NO payment sheet, NO card entry needed - just 3D Secure popup
const { error, paymentIntent } = await stripe.confirmPayment({
  clientSecret: response.clientSecret,
  confirmParams: {
    return_url: `${window.location.origin}/subscription-success`,
  },
  redirect: "if_required", // Only redirect if 3D Secure popup is required
});

if (error) {
  // Handle error (3D Secure failed, etc.)
  showError(error.message);
} else if (
  paymentIntent.status === "succeeded" ||
  paymentIntent.status === "requires_capture" ||
  paymentIntent.status === "processing"
) {
  // Payment successful - call confirm-payment endpoint to sync status
  await syncSubscriptionStatus(response.subscriptionId);
  showSuccessMessage();
}
```

### If `hasPaymentMethod === false` (No payment method attached)

**Use Payment Element to collect card first, then confirm payment**

```javascript
// Initialize Stripe Elements with Payment Element
const elements = stripe.elements({
  clientSecret: response.clientSecret,
  appearance: { theme: "stripe" },
});

// Create Payment Element (shows payment sheet to collect card)
const paymentElement = elements.create("payment", {
  defaultValues: {
    billingDetails: {
      email: userEmail, // Optional: pre-fill email
    },
  },
});

// Mount Payment Element to a container
paymentElement.mount("#payment-element");

// When user submits, confirm payment
async function handleSubmit() {
  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,
    clientSecret: response.clientSecret,
    confirmParams: {
      return_url: `${window.location.origin}/subscription-success`,
    },
    redirect: "if_required", // Only redirect if 3D Secure is required
  });

  if (error) {
    // Handle error (card declined, etc.)
    showError(error.message);
  } else if (
    paymentIntent.status === "succeeded" ||
    paymentIntent.status === "requires_capture" ||
    paymentIntent.status === "processing"
  ) {
    // Payment successful - call confirm-payment endpoint to sync status
    await syncSubscriptionStatus(response.subscriptionId);
    showSuccessMessage();
  }
}
```

---

### Scenario 2: Payment Method Collection Needed (SetupIntent)

**When:** No payment method provided, need to collect card first

```json
{
  "success": true,
  "setupIntentClientSecret": "seti_xxx_secret_xxx",
  "isPaymentIntent": false,
  "clientSecret": undefined,
  "requiresPaymentMethod": true,
  "message": "Use the setupIntentClientSecret with Stripe Elements to collect card details. Then call this endpoint again with the paymentMethodId."
}
```

**Frontend Action:**

```javascript
// Use stripe.confirmSetup() to collect and save payment method
const { error, setupIntent } = await stripe.confirmSetup({
  clientSecret: response.setupIntentClientSecret,
  confirmParams: {},
});

if (error) {
  // Handle error
} else if (setupIntent.status === "succeeded") {
  // Payment method saved - call API again with paymentMethodId
  const paymentMethodId = setupIntent.payment_method;
  await createPaymentIntent(subscriptionId, userId, paymentMethodId);
}
```

---

### Scenario 3: Payment Succeeded (No Action Needed)

**When:** Payment processed successfully without 3D Secure

```json
{
  "success": true,
  "subscriptionId": "uuid",
  "stripeSubscriptionId": "sub_xxx",
  "stripeCustomerId": "cus_xxx",
  "status": "active",
  "totalPrice": 99.99,
  "message": "Subscription created and payment processed successfully!"
}
```

**Frontend Action:** No payment confirmation needed. Subscription is active.

---

## Frontend Implementation Logic

### HTML Structure for Payment Element

```html
<!-- Container for Payment Element (payment sheet) -->
<div id="payment-element">
  <!-- Stripe Payment Element will be mounted here -->
  <!-- This shows:
       - Saved payment methods (if subscription has payment method)
       - Option to enter new card
       - 3D Secure authentication if needed
  -->
</div>

<!-- Submit button -->
<button id="submit-payment" type="button">Complete Payment</button>

<!-- Error display -->
<div id="payment-errors" role="alert"></div>
```

### Step 1: Call the API

```javascript
const response = await fetch(
  `/api/v1/users/subscription/${subscriptionId}/create-payment-intent/${userId}?paymentMethodId=${paymentMethodId}`,
  { method: "GET" }
);
const data = await response.json();
```

### Step 2: Branch Based on Response Type

```javascript
if (data.isPaymentIntent === true) {
  // PaymentIntent Flow - 3D Secure or immediate payment
  await handlePaymentIntent(data);
} else if (data.setupIntentClientSecret) {
  // SetupIntent Flow - Collect payment method
  await handleSetupIntent(data);
} else if (data.status === "active") {
  // Payment already succeeded
  showSuccessMessage();
}
```

### Step 3: Handle PaymentIntent (3D Secure with Payment Sheet)

```javascript
let paymentElement = null;
let elements = null;

async function handlePaymentIntent(data) {
  if (!data.clientSecret) {
    throw new Error("Client secret not found");
  }

  // Check if payment method is already attached
  if (data.hasPaymentMethod === true) {
    // Payment method exists - just confirm 3D Secure, NO payment sheet
    await confirmPaymentWithExistingMethod(data);
  } else {
    // No payment method - show payment sheet to collect card
    await showPaymentSheet(data);
  }
}

// Confirm payment with existing payment method (NO payment sheet)
async function confirmPaymentWithExistingMethod(data) {
  try {
    // Direct confirmation - uses existing payment method
    // Only shows 3D Secure popup if needed, no payment sheet
    const { error, paymentIntent } = await stripe.confirmPayment({
      clientSecret: data.clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/subscription-success?subscriptionId=${data.subscriptionId}`,
      },
      redirect: "if_required", // Only redirect if 3D Secure popup is required
    });

    if (error) {
      showError(error.message);
      return;
    }

    // Check payment status
    if (
      paymentIntent.status === "succeeded" ||
      paymentIntent.status === "requires_capture" ||
      paymentIntent.status === "processing"
    ) {
      // Sync subscription status with backend
      await syncSubscriptionStatus(data.subscriptionId);
      showSuccessMessage();
    }
  } catch (err) {
    showError(err.message);
  }
}

// Show payment sheet to collect card (when no payment method exists)
async function showPaymentSheet(data) {
  // Initialize Stripe Elements with Payment Element
  elements = stripe.elements({
    clientSecret: data.clientSecret,
    appearance: { theme: "stripe" },
  });

  // Create Payment Element
  paymentElement = elements.create("payment", {
    defaultValues: {
      billingDetails: {
        email: userEmail, // Optional: pre-fill with user email
      },
    },
  });

  // Mount Payment Element to container (show payment sheet)
  paymentElement.mount("#payment-element");

  // Show payment form UI
  showPaymentForm();
}

// When user submits the payment form (after entering card)
async function confirmPaymentWithNewCard(data) {
  try {
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret: data.clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/subscription-success?subscriptionId=${data.subscriptionId}`,
      },
      redirect: "if_required", // Only redirect if 3D Secure popup is required
    });

    if (error) {
      showError(error.message);
      return;
    }

    // Check payment status
    if (
      paymentIntent.status === "succeeded" ||
      paymentIntent.status === "requires_capture" ||
      paymentIntent.status === "processing"
    ) {
      // Sync subscription status with backend
      await syncSubscriptionStatus(data.subscriptionId);
      showSuccessMessage();
    }
  } catch (err) {
    showError(err.message);
  }
}
```

### Step 4: Handle SetupIntent (Collect Card)

```javascript
async function handleSetupIntent(data) {
  if (!data.setupIntentClientSecret) {
    throw new Error("Setup intent client secret not found");
  }

  const { error, setupIntent } = await stripe.confirmSetup({
    clientSecret: data.setupIntentClientSecret,
    confirmParams: {},
  });

  if (error) {
    showError(error.message);
    return;
  }

  if (setupIntent.status === "succeeded") {
    // Payment method saved - call API again with paymentMethodId
    const paymentMethodId = setupIntent.payment_method;
    await createPaymentIntent(subscriptionId, userId, paymentMethodId);
  }
}
```

### Step 5: Sync Subscription Status

```javascript
async function syncSubscriptionStatus(subscriptionId) {
  try {
    const response = await fetch(
      `/api/v1/users/subscription/${subscriptionId}/confirm-payment`,
      { method: "POST" }
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error syncing subscription status:", error);
  }
}
```

---

## Key Fields to Check

| Field                     | Type    | Purpose                                                                                                                              |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `isPaymentIntent`         | boolean | `true` = Use `stripe.confirmPayment()`, `false` = Use `stripe.confirmSetup()`                                                        |
| `hasPaymentMethod`        | boolean | `true` = Payment method attached, use `confirmPayment()` directly (NO payment sheet). `false` = Show Payment Element to collect card |
| `clientSecret`            | string  | PaymentIntent client secret for 3D Secure                                                                                            |
| `paymentMethodId`         | string  | Payment method ID if already attached (optional)                                                                                     |
| `setupIntentClientSecret` | string  | SetupIntent client secret for collecting payment method                                                                              |
| `status`                  | string  | Subscription status: `"active"`, `"incomplete"`, `"past_due"`, etc.                                                                  |
| `requiresAction`          | boolean | Indicates 3D Secure authentication required                                                                                          |
| `requiresPaymentMethod`   | boolean | Indicates payment method needs to be collected                                                                                       |

---

## Important Notes

1. **Check `hasPaymentMethod` field when `isPaymentIntent === true`:**

   - If `hasPaymentMethod === true`: Use `stripe.confirmPayment()` directly with `clientSecret` - NO payment sheet, just 3D Secure popup
   - If `hasPaymentMethod === false`: Use Payment Element to collect card first, then `stripe.confirmPayment()` with `elements`

2. **DO NOT use `stripe.confirmSetup()` when `isPaymentIntent === true`**

   - Always use `stripe.confirmPayment()` for PaymentIntent flows

3. **DO NOT use `stripe.confirmPayment()` when `isPaymentIntent === false`**

   - Always use `stripe.confirmSetup()` for SetupIntent flows

4. **After successful payment confirmation, call the sync endpoint:**

   - `POST /api/v1/users/subscription/:id/confirm-payment`
   - This ensures the backend database is updated with the latest Stripe status

5. **Payment Status Values:**
   - `succeeded` - Payment completed successfully
   - `requires_capture` - Payment authorized, needs capture (treat as success)
   - `processing` - Payment is processing (treat as success, will complete)
   - `requires_action` - Additional authentication needed (shouldn't occur with confirmPayment)

---

## Error Handling

```javascript
try {
  const response = await createPaymentIntent(
    subscriptionId,
    userId,
    paymentMethodId
  );

  if (response.isPaymentIntent === true) {
    await handlePaymentIntent(response);
  } else if (response.setupIntentClientSecret) {
    await handleSetupIntent(response);
  }
} catch (error) {
  if (error.type === "StripeCardError") {
    // Card was declined
    showError(error.message);
  } else if (error.type === "StripeAuthenticationError") {
    // 3D Secure authentication failed
    showError("Authentication failed. Please try again.");
  } else {
    // Other errors
    showError("Payment failed. Please try again.");
  }
}
```

---

## Complete Flow Example

```javascript
async function processSubscriptionPayment(
  subscriptionId,
  userId,
  paymentMethodId = null
) {
  try {
    // Step 1: Get payment intent
    const response = await fetch(
      `/api/v1/users/subscription/${subscriptionId}/create-payment-intent/${userId}${paymentMethodId ? `?paymentMethodId=${paymentMethodId}` : ""}`,
      { method: "GET" }
    );
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to create payment intent");
    }

    // Step 2: Handle based on response type
    if (data.isPaymentIntent === true && data.clientSecret) {
      // Check if payment method is already attached
      if (data.hasPaymentMethod === true) {
        // Payment method exists - just confirm 3D Secure, NO payment sheet
        const { error, paymentIntent } = await stripe.confirmPayment({
          clientSecret: data.clientSecret,
          confirmParams: {
            return_url: `${window.location.origin}/subscription-success?subscriptionId=${subscriptionId}`,
          },
          redirect: "if_required", // Only redirect if 3D Secure popup is needed
        });

        if (error) throw error;

        if (
          ["succeeded", "requires_capture", "processing"].includes(
            paymentIntent.status
          )
        ) {
          await syncSubscriptionStatus(subscriptionId);
          return { success: true, subscriptionId };
        }
      } else {
        // No payment method - show Payment Element to collect card
        const elements = stripe.elements({
          clientSecret: data.clientSecret,
          appearance: { theme: "stripe" },
        });

        const paymentElement = elements.create("payment");
        paymentElement.mount("#payment-element");

        // When user submits form
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          clientSecret: data.clientSecret,
          confirmParams: {
            return_url: `${window.location.origin}/subscription-success?subscriptionId=${subscriptionId}`,
          },
          redirect: "if_required", // Only redirect if 3D Secure popup is needed
        });

        if (error) throw error;

        if (
          ["succeeded", "requires_capture", "processing"].includes(
            paymentIntent.status
          )
        ) {
          // Sync status and show success
          await syncSubscriptionStatus(subscriptionId);
          return { success: true, subscriptionId };
        }
      }
    } else if (data.setupIntentClientSecret) {
      // Collect payment method
      const { error, setupIntent } = await stripe.confirmSetup({
        clientSecret: data.setupIntentClientSecret,
        confirmParams: {},
      });

      if (error) throw error;

      if (setupIntent.status === "succeeded") {
        // Retry with payment method
        return await processSubscriptionPayment(
          subscriptionId,
          userId,
          setupIntent.payment_method
        );
      }
    } else if (data.status === "active") {
      // Already active
      return { success: true, subscriptionId };
    }

    throw new Error("Unexpected payment status");
  } catch (error) {
    console.error("Payment error:", error);
    throw error;
  }
}
```

---

## Complete Example with Payment Element

### HTML

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Subscription Payment</title>
  </head>
  <body>
    <div id="payment-container">
      <h2>Complete Your Subscription Payment</h2>

      <!-- Payment Element Container -->
      <div id="payment-element">
        <!-- Stripe Payment Element mounts here -->
      </div>

      <!-- Error Display -->
      <div id="payment-errors" role="alert"></div>

      <!-- Submit Button -->
      <button id="submit-button" type="button">Complete Payment</button>

      <!-- Loading State -->
      <div id="loading" style="display: none;">Processing...</div>
    </div>

    <script src="https://js.stripe.com/v3/"></script>
    <script src="payment.js"></script>
  </body>
</html>
```

### JavaScript (payment.js)

```javascript
// Initialize Stripe
const stripe = Stripe("pk_test_..."); // Your publishable key

let elements = null;
let paymentElement = null;
let currentClientSecret = null;
let currentSubscriptionId = null;

// Initialize payment when page loads
async function initializePayment(subscriptionId, userId) {
  try {
    // Step 1: Get payment intent from backend
    const response = await fetch(
      `/api/v1/users/subscription/${subscriptionId}/create-payment-intent/${userId}`,
      { method: "GET" }
    );
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to create payment intent");
    }

    currentSubscriptionId = subscriptionId;
    currentClientSecret = data.clientSecret;

    // Step 2: Handle based on response type
    if (data.isPaymentIntent === true && data.clientSecret) {
      // PaymentIntent flow - Show payment sheet with Payment Element
      await setupPaymentElement(data);
    } else if (data.setupIntentClientSecret) {
      // SetupIntent flow - Collect payment method first
      await handleSetupIntent(data);
    } else if (data.status === "active") {
      // Payment already succeeded
      showSuccess("Subscription is already active!");
    }
  } catch (error) {
    showError(error.message);
  }
}

// Setup Payment Element for PaymentIntent
async function setupPaymentElement(data) {
  // Initialize Elements
  elements = stripe.elements({
    clientSecret: data.clientSecret,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "#0570de",
      },
    },
  });

  // Create Payment Element
  paymentElement = elements.create("payment", {
    layout: "tabs", // Shows tabs for saved cards and new card
    defaultValues: {
      billingDetails: {
        email: userEmail, // Pre-fill if available
      },
    },
  });

  // Mount Payment Element
  paymentElement.mount("#payment-element");

  // Set up submit handler
  document.getElementById("submit-button").onclick = async () => {
    await handleSubmit(data);
  };
}

// Handle form submission
async function handleSubmit(data) {
  const submitButton = document.getElementById("submit-button");
  const loading = document.getElementById("loading");

  setLoading(true);

  try {
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret: data.clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/subscription-success?subscriptionId=${data.subscriptionId}`,
      },
      redirect: "if_required", // Only redirect if 3D Secure popup needed
    });

    if (error) {
      showError(error.message);
      setLoading(false);
      return;
    }

    // Check payment status
    if (
      paymentIntent.status === "succeeded" ||
      paymentIntent.status === "requires_capture" ||
      paymentIntent.status === "processing"
    ) {
      // Sync subscription status
      await syncSubscriptionStatus(data.subscriptionId);
      showSuccess("Payment successful! Subscription activated.");
      // Redirect to success page
      window.location.href = `/subscription-success?subscriptionId=${data.subscriptionId}`;
    }
  } catch (err) {
    showError(err.message);
    setLoading(false);
  }
}

// Handle SetupIntent (collect payment method first)
async function handleSetupIntent(data) {
  const { error, setupIntent } = await stripe.confirmSetup({
    clientSecret: data.setupIntentClientSecret,
    confirmParams: {},
  });

  if (error) {
    showError(error.message);
    return;
  }

  if (setupIntent.status === "succeeded") {
    // Retry with payment method
    await initializePayment(subscriptionId, userId, setupIntent.payment_method);
  }
}

// Sync subscription status
async function syncSubscriptionStatus(subscriptionId) {
  try {
    await fetch(
      `/api/v1/users/subscription/${subscriptionId}/confirm-payment`,
      { method: "POST" }
    );
  } catch (error) {
    console.error("Error syncing subscription status:", error);
  }
}

// Helper functions
function setLoading(isLoading) {
  document.getElementById("submit-button").disabled = isLoading;
  document.getElementById("loading").style.display = isLoading
    ? "block"
    : "none";
}

function showError(message) {
  const errors = document.getElementById("payment-errors");
  errors.textContent = message;
  errors.style.display = "block";
}

function showSuccess(message) {
  alert(message); // Or use your preferred success notification
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const subscriptionId = urlParams.get("subscriptionId");
  const userId = urlParams.get("userId");

  if (subscriptionId && userId) {
    initializePayment(subscriptionId, userId);
  }
});
```

---

## Testing Checklist

- [ ] Test with card requiring 3D Secure (should show payment sheet with 3D Secure popup)
- [ ] Test with card not requiring 3D Secure (should process immediately)
- [ ] Test with subscription that has existing payment method (should show saved card option)
- [ ] Test without payment method (should use `confirmSetup` first)
- [ ] Test entering new card in payment sheet
- [ ] Test error handling for declined cards
- [ ] Test error handling for authentication failures
- [ ] Verify subscription status syncs after payment
- [ ] Verify UI shows correct status messages
- [ ] Verify payment sheet shows saved cards (if available)
