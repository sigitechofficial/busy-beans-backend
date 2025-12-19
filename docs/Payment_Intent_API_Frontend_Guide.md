# Payment Intent API - Frontend Integration Guide

## Endpoint

**POST** `/invoices/:orderId/create-payment-intent`

## Request

### Headers

```
Authorization: Bearer <token>
Content-Type: application/json
```

### URL Parameters

- `orderId` (required) - The order ID from the URL path

### Request Body

```json
{
  "orderType": "customer" | "local-partner"  // Optional, defaults to "customer"
}
```

## Response

### Success Response (200)

**For Regular Orders (customer/dropship):**

```json
{
  "status": "success",
  "data": {
    "clientSecret": "pi_xxx_secret_xxx",
    "paymentIntentId": "pi_xxx",
    "proportionalStripeFee": 2.5,
    "connectAccountId": null,
    "isDirectPartner": false
  }
}
```

**For Direct Partner Orders:**

```json
{
  "status": "success",
  "data": {
    "clientSecret": "pi_xxx_secret_xxx",
    "paymentIntentId": "pi_xxx",
    "proportionalStripeFee": 0,
    "connectAccountId": "acct_xxx",
    "isDirectPartner": true
  }
}
```

### Already Paid Response (200)

```json
{
  "status": "already-paid",
  "message": "As the payment for the order has already been made, we are unable to create a payment intent at this point.",
  "data": {}
}
```

### Error Response (400/404)

```json
{
  "status": "error",
  "message": "Error message here"
}
```

## Frontend Implementation

### 1. Create Payment Intent

```javascript
const createPaymentIntent = async (orderId, orderType = "customer") => {
  try {
    const response = await fetch(`/invoices/${orderId}/create-payment-intent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderType }),
    });

    const result = await response.json();

    if (result.status === "already-paid") {
      // Handle already paid case
      console.log(result.message);
      return null;
    }

    if (result.status === "success") {
      return result.data.clientSecret;
    }

    throw new Error(result.message || "Failed to create payment intent");
  } catch (error) {
    console.error("Error creating payment intent:", error);
    throw error;
  }
};
```

### 2. Use with Stripe Elements

```javascript
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

// In your component
const [clientSecret, setClientSecret] = useState(null);

useEffect(() => {
  const fetchClientSecret = async () => {
    const secret = await createPaymentIntent(orderId, orderType);
    setClientSecret(secret);
  };

  fetchClientSecret();
}, [orderId, orderType]);

// Payment Form Component
const PaymentForm = ({ clientSecret }) => {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
      },
    });

    if (error) {
      console.error("Payment failed:", error.message);
    } else if (paymentIntent.status === "succeeded") {
      console.log("Payment succeeded!");
      // Redirect or update UI
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          // Enable save card option
          paymentMethodTypes: ["card"],
          // Show save card checkbox
          terms: {
            card: "always",
          },
        }}
      />
      <button type="submit" disabled={!stripe}>
        Pay Now
      </button>
    </form>
  );
};

// Main Component
const CheckoutPage = ({ orderId, orderType }) => {
  const [clientSecret, setClientSecret] = useState(null);
  const [isDirectPartner, setIsDirectPartner] = useState(false);
  const [connectAccountId, setConnectAccountId] = useState(null);
  const [connectedAccountPublishableKey, setConnectedAccountPublishableKey] =
    useState(null);

  useEffect(() => {
    const fetchPaymentIntent = async () => {
      try {
        const response = await fetch(
          `/invoices/${orderId}/create-payment-intent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ orderType }),
          }
        );

        const result = await response.json();

        if (result.status === "success") {
          setClientSecret(result.data.clientSecret);
          setIsDirectPartner(result.data.isDirectPartner || false);
          setConnectAccountId(result.data.connectAccountId);

          // If direct partner, fetch the connected account's publishable key
          if (result.data.isDirectPartner && result.data.connectAccountId) {
            // You'll need to create an endpoint to retrieve the connected account's publishable key
            // OR use Stripe's API directly from frontend (not recommended for security)
            // For now, you may need to handle this server-side
            const accountKey = await fetchConnectedAccountPublishableKey(
              result.data.connectAccountId
            );
            setConnectedAccountPublishableKey(accountKey);
          }
        }
      } catch (error) {
        console.error("Error fetching payment intent:", error);
      }
    };

    fetchPaymentIntent();
  }, [orderId, orderType]);

  // Use appropriate publishable key based on partner type
  const stripePromise =
    isDirectPartner && connectedAccountPublishableKey
      ? loadStripe(connectedAccountPublishableKey)
      : loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

  return (
    <div>
      {clientSecret && (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            // Enable save card functionality
            appearance: {
              theme: "stripe",
            },
            // Customer is required for save card to work
            // The backend automatically attaches customer when available
          }}
        >
          <PaymentForm clientSecret={clientSecret} />
        </Elements>
      )}
    </div>
  );
};
```

## Important Notes

1. **Publishable Key**:

   - **Regular Orders** (`isDirectPartner: false`): Use the **platform's publishable key**
   - **Direct Partner Orders** (`isDirectPartner: true`): The PaymentIntent is created on the connected account. You need to use the connected account's publishable key or handle it differently (see Direct Partner section below)

2. **Client Secret**: The `clientSecret` is used directly with Stripe Elements. It's valid until the payment is completed or expires.

3. **Save Card Option**: The save card option is automatically enabled when:

   - A customer is attached to the PaymentIntent (handled automatically by backend)
   - `setup_future_usage: "off_session"` is set (handled automatically by backend)
   - The PaymentElement will show a "Save card for future payments" checkbox

4. **Order Types**:

   - `"customer"` - Regular customer orders (uses platform account)
   - `"local-partner"` - Local partner orders (may be direct-partner or dropship)

5. **Direct Partner Payments**:

   - When `isDirectPartner: true`, the PaymentIntent is created on the connected account (`connectAccountId`)
   - The `clientSecret` is scoped to that connected account
   - You need to retrieve the connected account's publishable key from Stripe or use a different initialization method
   - Check the `connectAccountId` and `isDirectPartner` flags in the response

6. **Error Handling**: Always check for `status === "already-paid"` before attempting to create a payment intent.

7. **Payment Status**: After successful payment, verify the payment status on your backend before marking the order as paid.

## Example Flow

1. User clicks "Pay Invoice" button
2. Frontend calls `/invoices/:orderId/create-payment-intent`
3. Backend returns `clientSecret` and `isDirectPartner` flag
4. If `isDirectPartner: true`, fetch connected account's publishable key
5. Frontend initializes Stripe Elements with appropriate publishable key and `clientSecret`
6. User enters payment details and submits
7. Stripe confirms payment
8. Frontend redirects to success page or updates UI

## Direct Partner Payment Handling

For direct partner orders (`isDirectPartner: true`), the PaymentIntent is created on the connected account. You have two options:

### Option 1: Retrieve Connected Account Publishable Key (Recommended)

Create a backend endpoint to retrieve the connected account's publishable key, then use it to initialize Stripe:

```javascript
const fetchConnectedAccountPublishableKey = async (connectAccountId) => {
  // Call your backend endpoint that retrieves the publishable key
  const response = await fetch(
    `/api/stripe/connected-account/${connectAccountId}/publishable-key`
  );
  const data = await response.json();
  return data.publishableKey;
};
```

### Option 2: Use Account Parameter (If supported)

Some Stripe implementations allow using the account parameter, but this may not work with PaymentIntents created on connected accounts. Check Stripe's latest documentation.

## Testing

Use Stripe test cards:

- Success: `4242 4242 4242 4242`
- Requires 3D Secure: `4000 0025 0000 3155`
- Declined: `4000 0000 0000 0002`
