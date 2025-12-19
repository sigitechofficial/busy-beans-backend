# Frontend Implementation Guide: 3D Secure Subscription Payment

## 📋 Overview

The subscription payment API has been updated to handle both **normal cards** and **3D Secure cards** (cards that require authentication). The frontend needs to handle the payment confirmation flow when a subscription requires 3D Secure authentication.

## 🔄 How It Works

### Normal Cards (No 3D Secure)

- Card is attached ✅
- Subscription is created ✅
- Payment is processed immediately ✅
- Subscription status: **`active`** ✅
- **No frontend action needed** - payment is complete

### 3D Secure Cards (Requires Authentication)

- Card is attached ✅
- Subscription is created ✅
- Payment requires authentication ⚠️
- Subscription status: **`incomplete`** ⚠️
- **Frontend MUST confirm payment** using `clientSecret` ⚠️
- After confirmation → Subscription status: **`active`** ✅

---

## 📡 API Response Structure

When calling the subscription payment endpoint:

- **Endpoint**: `GET /api/v1/users/subscription/:id/create-payment-intent/:userId?paymentMethodId=pm_xxx`

### Response for Normal Cards:

```json
{
  "success": true,
  "subscriptionId": "uuid",
  "stripeSubscriptionId": "sub_xxx",
  "stripeCustomerId": "cus_xxx",
  "status": "active",
  "totalPrice": "235.00",
  "message": "Subscription created and payment processed successfully!"
}
```

### Response for 3D Secure Cards:

```json
{
  "success": true,
  "subscriptionId": "uuid",
  "stripeSubscriptionId": "sub_xxx",
  "stripeCustomerId": "cus_xxx",
  "status": "incomplete",
  "totalPrice": "235.00",
  "clientSecret": "pi_xxx_secret_xxx",
  "requiresAction": true,
  "message": "Payment requires 3D Secure authentication. Use clientSecret with stripe.confirmCardPayment() to complete the payment."
}
```

---

## 💻 Frontend Implementation

### Step 1: Call the API to Create Payment Intent

```javascript
// After user provides paymentMethodId (from Stripe Elements)
const response = await fetch(
  `/api/v1/users/subscription/${subscriptionId}/create-payment-intent/${userId}?paymentMethodId=${paymentMethodId}`,
  {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      // Add auth headers if needed
    },
  }
);

const data = await response.json();
```

### Step 2: Handle the Response

```javascript
if (!data.success) {
  // Handle error
  console.error("Failed to create payment intent:", data.message);
  showError(data.message);
  return;
}

// Check if 3D Secure authentication is required
if (data.requiresAction && data.clientSecret) {
  // 3D Secure card - need to confirm payment
  await confirmPaymentWith3DS(data.clientSecret, paymentMethodId);
} else if (data.status === "active") {
  // Normal card - payment already processed
  showSuccess("Subscription created successfully!");
  redirectToSuccessPage(data.subscriptionId);
} else {
  // Unexpected state
  console.warn("Unexpected subscription status:", data.status);
  showError("Payment status unclear. Please check your subscription.");
}
```

### Step 3: Confirm 3D Secure Payment

```javascript
const confirmPaymentWith3DS = async (clientSecret, paymentMethodId) => {
  try {
    // Initialize Stripe (you should already have this)
    const stripe = Stripe("pk_test_your_publishable_key"); // Use your Stripe publishable key

    // Show loading state
    setLoading(true);
    setMessage("Authenticating payment...");

    // Confirm the payment with 3D Secure
    const { error, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: paymentMethodId,
      }
    );

    if (error) {
      // Handle error (card declined, authentication failed, etc.)
      console.error("Payment confirmation failed:", error);
      showError(
        error.message || "Payment authentication failed. Please try again."
      );
      setLoading(false);
      return;
    }

    // Check payment intent status
    if (
      paymentIntent.status === "succeeded" ||
      paymentIntent.status === "requires_capture"
    ) {
      // Payment succeeded! Now sync subscription status from Stripe
      await syncSubscriptionStatus(data.subscriptionId);
      showSuccess("Payment confirmed! Subscription is now active.");
      redirectToSuccessPage(data.subscriptionId);
    } else if (paymentIntent.status === "requires_action") {
      // Still requires action (shouldn't happen after confirmCardPayment, but handle it)
      showError("Payment still requires action. Please try again.");
    } else {
      // Other status (processing, etc.)
      showMessage("Payment is being processed. Please wait...");
      // Optionally poll for status updates
    }

    setLoading(false);
  } catch (err) {
    console.error("Error confirming payment:", err);
    showError("An unexpected error occurred. Please try again.");
    setLoading(false);
  }
};

// Helper function to sync subscription status after payment confirmation
const syncSubscriptionStatus = async (subscriptionId) => {
  try {
    const response = await fetch(
      `/api/v1/users/subscription/${subscriptionId}/confirm-payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Add auth headers if needed
        },
      }
    );

    const data = await response.json();

    if (data.success && data.status === "active") {
      console.log("✅ Subscription status synced to active");
      return true;
    } else {
      console.warn("⚠️ Subscription status:", data.status);
      return false;
    }
  } catch (err) {
    console.error("Error syncing subscription status:", err);
    // Don't block the flow - status will sync via webhook eventually
    return false;
  }
};
```

---

## 🎨 Complete Example (React/Next.js)

```javascript
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe("pk_test_your_publishable_key");

function SubscriptionPaymentForm({ subscriptionId, userId, paymentMethodId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleCreateSubscription = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Step 1: Call API to create payment intent
      const response = await fetch(
        `/api/v1/users/subscription/${subscriptionId}/create-payment-intent/${userId}?paymentMethodId=${paymentMethodId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            // Add your auth headers
          },
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to create payment intent");
      }

      // Step 2: Check if 3D Secure is required
      if (data.requiresAction && data.clientSecret) {
        // 3D Secure required - confirm payment
        const stripe = await stripePromise;

        const { error: confirmError, paymentIntent } =
          await stripe.confirmCardPayment(data.clientSecret, {
            payment_method: paymentMethodId,
          });

        if (confirmError) {
          throw new Error(confirmError.message);
        }

        if (paymentIntent.status === "succeeded") {
          // Sync subscription status from Stripe to database
          await syncSubscriptionStatus(data.subscriptionId);
          setSuccess(true);
          // Redirect or show success message
        } else {
          throw new Error("Payment confirmation failed");
        }
      } else if (data.status === "active") {
        // Normal card - payment already processed
        setSuccess(true);
      } else {
        throw new Error("Unexpected subscription status");
      }
    } catch (err) {
      setError(err.message);
      console.error("Subscription payment error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleCreateSubscription} disabled={loading}>
        {loading ? "Processing..." : "Confirm Subscription"}
      </button>

      {error && <div className="error">{error}</div>}
      {success && (
        <div className="success">Subscription created successfully!</div>
      )}
    </div>
  );
}
```

---

## ✅ Checklist for Frontend Developer

- [ ] Handle API response and check for `requiresAction` flag
- [ ] Implement `stripe.confirmCardPayment()` for 3D Secure cards
- [ ] Show appropriate loading states during payment confirmation
- [ ] Handle errors from payment confirmation (card declined, etc.)
- [ ] Show success message when payment is confirmed
- [ ] Handle both `status: "active"` (normal cards) and `status: "incomplete"` (3D Secure cards)
- [ ] Test with both normal cards and 3D Secure test card: `4000002760003184`
- [ ] Call `/subscription/:id/confirm-payment` endpoint after `confirmCardPayment()` succeeds to sync subscription status

---

## 🧪 Testing

### Test with Normal Card:

Use a normal test card (e.g., `4242 4242 4242 4242`)

- Expected: Subscription becomes `active` immediately
- No `clientSecret` needed

### Test with 3D Secure Card:

Use Stripe's 3D Secure test card: `4000 0027 6000 3184`

- Expected: Subscription status is `incomplete`
- `clientSecret` is returned
- Must call `stripe.confirmCardPayment()` to complete
- After confirmation: Call `/subscription/:id/confirm-payment` endpoint to sync status
- Subscription becomes `active` after syncing

---

## 📝 Important Notes

1. **Always check for `clientSecret`** - It's only present when 3D Secure is required
2. **Always check `status`** - `"incomplete"` means action is needed, `"active"` means payment succeeded
3. **Handle errors gracefully** - Payment confirmation can fail (card declined, network error, etc.)
4. **Show clear messages** - Let users know what's happening (authenticating, processing, etc.)
5. **Use Stripe.js v3** - Make sure you're using the latest Stripe.js library

---

## 🆘 Support

If you have questions or issues:

- Check Stripe's documentation: https://stripe.com/docs/payments/3d-secure
- Check API response structure above
- Verify you're using the correct `clientSecret` format (`pi_xxx_secret_xxx`)
