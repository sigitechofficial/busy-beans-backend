/**
 * Website invoice payment verification (services/invoicePaymentVerification.js) with Stripe stubbed:
 * made-up / other-order / unfinished payments are refused; a succeeded payment for this order is
 * accepted, and one that is lower than the invoice (invoice raised after paying started) is still
 * accepted with the shortfall reported, so a charged customer is never left "unpaid".
 *
 *   node scripts/invoicePaymentVerificationTest.js        (no API, database or Stripe needed)
 */
const Module = require("module");

const intents = {
  pi_paidfull123: { id: "pi_paidfull123", status: "succeeded", amount_received: 12345, metadata: { orderId: "77" } },
  pi_paidshort123: { id: "pi_paidshort123", status: "succeeded", amount_received: 10000, metadata: { orderId: "77" } },
  pi_otherorder123: { id: "pi_otherorder123", status: "succeeded", amount_received: 12345, metadata: { orderId: "78" } },
  pi_processing123: { id: "pi_processing123", status: "processing", amount_received: 0, metadata: { orderId: "77" } },
  pi_failed12345: { id: "pi_failed12345", status: "requires_payment_method", amount_received: 0, metadata: { orderId: "77" } },
};
function FakeStripe() {
  return {
    paymentIntents: {
      retrieve: async (id) => {
        if (!intents[id]) throw new Error("No such payment_intent");
        return intents[id];
      },
    },
  };
}
const realLoad = Module._load;
Module._load = function load(request, ...rest) {
  if (request === "stripe") return FakeStripe;
  return realLoad.call(this, request, ...rest);
};
const { verifyInvoicePayment, invoiceTotal } = require("../services/invoicePaymentVerification");

const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
};

(async () => {
  const total = invoiceTotal({ items: [{ price: "100.00" }, { price: "13.45" }], shippingCharges: "10", vat: "0" });
  check(Math.round(total * 100) === 12345, `invoice total = lines + shipping + VAT (got ${total})`);

  let v = await verifyInvoicePayment({ paymentIntentId: "not-a-pi", orderId: 77, expectedTotal: total });
  check(!v.ok && v.reason === "invalid", "malformed payment id refused");
  v = await verifyInvoicePayment({ paymentIntentId: "pi_doesnotexist1", orderId: 77, expectedTotal: total });
  check(!v.ok && v.reason === "not_found", "unknown payment id refused");
  v = await verifyInvoicePayment({ paymentIntentId: "pi_otherorder123", orderId: 77, expectedTotal: total });
  check(!v.ok && v.reason === "order_mismatch", "payment made for another order refused");
  v = await verifyInvoicePayment({ paymentIntentId: "pi_processing123", orderId: 77, expectedTotal: total });
  check(!v.ok && v.reason === "processing", "processing payment not marked paid yet");
  v = await verifyInvoicePayment({ paymentIntentId: "pi_failed12345", orderId: 77, expectedTotal: total });
  check(!v.ok && v.reason === "not_succeeded", "unfinished payment refused");
  v = await verifyInvoicePayment({ paymentIntentId: "pi_paidfull123", orderId: "77", expectedTotal: total });
  check(v.ok && v.shortByCents === 0, `full payment accepted (got ${JSON.stringify(v)})`);
  v = await verifyInvoicePayment({ paymentIntentId: "pi_paidshort123", orderId: 77, expectedTotal: total });
  check(v.ok && v.shortByCents === 2345, `payment below a raised invoice still accepted, shortfall reported (got ${JSON.stringify(v)})`);

  if (failures.length) {
    console.log(`[invoice-payment-verification] ${failures.length} failure(s)`);
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    process.exitCode = 1;
  } else {
    console.log("[invoice-payment-verification] passed");
  }
})();
