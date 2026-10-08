/**
 * Website invoice payments (users/invoices/:orderId/confirm-payment): before an order is marked
 * paid, Stripe must confirm the payment intent succeeded and was made for this order. Whoever paid
 * (owner, colleague with the pay link) does not matter; a made-up or unrelated payment id does.
 * The amount is set by the server when the payment starts, so a lower amount only means the invoice
 * was raised after the customer started paying: the money was taken, so the invoice is still marked
 * paid and `shortByCents` is reported for staff (never a charged customer left "unpaid").
 */
const Stripe = require("stripe");

let client = null;
const stripe = () => {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });
  return client;
};

const PI_ID = /^pi_[A-Za-z0-9_]{6,200}$/;

/** Same estimate as controllers/stripe.js (2.9% + $0.30). */
const estimateStripeFee = (dollars) => Number(dollars || 0) * 0.029 + 0.3;

/** Invoice total as charged by the website payment intent: line totals + shipping + VAT. */
function invoiceTotal(details) {
  const items = (details?.items || []).reduce((sum, it) => sum + Number(it.price || 0), 0);
  return items + Number(details?.shippingCharges || 0) + Number(details?.vat || 0);
}

/**
 * @returns {Promise<{ ok: true, paymentIntent, shortByCents: number } | { ok: false, reason: string, message: string }>}
 */
async function verifyInvoicePayment({ paymentIntentId, orderId, expectedTotal }) {
  if (!PI_ID.test(String(paymentIntentId || ""))) {
    return { ok: false, reason: "invalid", message: "Invalid payment reference." };
  }
  let paymentIntent;
  try {
    paymentIntent = await stripe().paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    return { ok: false, reason: "not_found", message: "Payment could not be verified with Stripe." };
  }
  if (String(paymentIntent?.metadata?.orderId || "") !== String(orderId)) {
    return { ok: false, reason: "order_mismatch", message: "This payment does not belong to this invoice." };
  }
  if (paymentIntent.status === "processing") {
    return { ok: false, reason: "processing", message: "The payment is still processing. The invoice will be marked paid when it completes." };
  }
  if (paymentIntent.status !== "succeeded") {
    return { ok: false, reason: "not_succeeded", message: "The payment has not succeeded." };
  }
  const expectedCents = Math.round(Number(expectedTotal || 0) * 100);
  const shortByCents = Math.max(0, expectedCents - Number(paymentIntent.amount_received || 0));
  return { ok: true, paymentIntent, shortByCents };
}

module.exports = { verifyInvoicePayment, invoiceTotal, estimateStripeFee };
