require("dotenv").config();
const { STRIPE_SECRET_KEY } = process.env;

const StripeSdk = require("stripe");
const stripe = new StripeSdk(STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

const { user } = require("../models");
const StripeLegacy = require("./stripe");

function estimateStripeFeeFromDollars(amountInDollars) {
  const parsed = parseFloat(amountInDollars);
  if (isNaN(parsed)) throw new Error("Invalid dollar amount");
  return parsed * 0.029 + 0.3;
}

function convertToCents(amount) {
  return Math.round(parseFloat(amount) * 100);
}

async function getOrCreateConnectedCustomerForDirectPartner(orderRow) {
  const existingId = orderRow.stripeCustomerIdForPartner;
  if (existingId) return existingId;

  const connectAccountId = orderRow.connectAccountId;
  const name = orderRow.companyName || "Customer";
  const email = orderRow.email;
  if (!connectAccountId || !email) {
    throw new Error(
      "Connect account and customer email are required for direct-partner checkout.",
    );
  }

  const customerId = await StripeLegacy.addCustomerOnConnectedAccount({
    connectAccountId,
    name,
    email,
  });

  if (orderRow.userId) {
    await user.update(
      { stripeCustomerIdForPartner: customerId },
      { where: { id: orderRow.userId } },
    );
  }

  return customerId;
}

function buildInvoiceLineItems(orders, currency = "usd") {
  return orders.map((orderRow) => {
    const invoiceNumber = orderRow.invoiceNumber || `Order-${orderRow.id}`;
    const lineTotal = parseFloat(orderRow.totalBill || 0);
    return {
      price_data: {
        currency,
        product_data: {
          name: `Invoice ${invoiceNumber}`,
          description: `Order #${orderRow.id}`,
        },
        unit_amount: convertToCents(lineTotal),
      },
      quantity: 1,
    };
  });
}

function buildMetadata({ batch, orders }) {
  const orderIds = orders.map((o) => o.id).join(",");
  const invoiceNumbers = orders
    .map((o) => o.invoiceNumber || `Order-${o.id}`)
    .join(", ");

  return {
    multipleInvoices: "yes",
    checkoutBatchId: String(batch.id),
    orderIds,
    invoiceNumbers,
    userId: String(batch.userId),
    salesRepId: batch.salesRepId ? String(batch.salesRepId) : "",
    partnerId: batch.connectAccountId || "",
    orderType: "customer",
    type: "multi-checkout-session",
    platform: "Busy Bean Coffee Inc.",
  };
}

function buildDescription(orders) {
  const labels = orders
    .map((o) => o.invoiceNumber || `#${o.id}`)
    .slice(0, 10);
  const suffix =
    orders.length > 10 ? ` and ${orders.length - 10} more` : "";
  return `Payment for invoices ${labels.join(", ")}${suffix} (${orders.length} invoices)`;
}

/**
 * Create a Stripe Checkout Session for multiple invoices (one line item per invoice).
 */
async function createMultiInvoiceCheckoutSession({
  orders,
  batch,
  currency = "usd",
}) {
  if (!orders?.length) {
    throw new Error("At least one order is required for multi-invoice checkout.");
  }

  const line_items = buildInvoiceLineItems(orders, currency);
  const metadata = buildMetadata({ batch, orders });
  const description = buildDescription(orders);

  const base = {
    payment_method_types: ["card"],
    mode: "payment",
    line_items,
    metadata,
    success_url: "https://www.busybeancoffee.com/products?status=success",
    cancel_url: "https://www.busybeancoffee.com/products?status=cancel",
    saved_payment_method_options: { payment_method_save: "enabled" },
    payment_intent_data: {
      description,
      metadata,
    },
  };

  const first = orders[0];
  const partnerType = first.partnerType || null;
  const isDirectPartner = partnerType === "direct-partner";

  if (isDirectPartner) {
    if (!first.connectAccountId) {
      throw new Error("Connect account id is required for direct-partner batch.");
    }

    const directParams = { ...base };
    directParams.customer = await getOrCreateConnectedCustomerForDirectPartner(first);
    directParams.payment_intent_data.setup_future_usage = "off_session";

    const session = await stripe.checkout.sessions.create(directParams, {
      stripeAccount: first.connectAccountId,
    });

    return {
      invoiceId: session.id,
      hostedInvoiceUrl: session.url,
      proportionalStripeFee: 0,
    };
  }

  const totalStripeFee = orders.reduce(
    (sum, o) => sum + estimateStripeFeeFromDollars(o.totalBill || 0),
    0,
  );
  const totalAdminProfitCents = orders.reduce((sum, o) => {
    const platformFee = convertToCents(o.adminReceivableAmount || 0);
    const stripeFee = convertToCents(
      estimateStripeFeeFromDollars(o.totalBill || 0),
    );
    return sum + platformFee + stripeFee;
  }, 0);

  const input = {
    ...base,
    customer: first.stripeCustomerId || undefined,
  };

  if (first.connectAccountId) {
    input.payment_intent_data.application_fee_amount = totalAdminProfitCents;
    input.payment_intent_data.transfer_data = {
      destination: first.connectAccountId,
    };
    input.payment_intent_data.setup_future_usage = "off_session";
  }

  const session = await stripe.checkout.sessions.create(input);

  return {
    invoiceId: session.id,
    hostedInvoiceUrl: session.url,
    proportionalStripeFee: totalStripeFee,
  };
}

async function checkMultiInvoiceSessionStatus(sessionId, connectAccountId = null) {
  try {
    const options = connectAccountId ? { stripeAccount: connectAccountId } : {};
    const session = await stripe.checkout.sessions.retrieve(sessionId, options);

    if (session.payment_status === "paid") return "paid";

    const expiresAt = session.expires_at * 1000;
    if (expiresAt < Date.now()) return "expired";

    return "open";
  } catch (err) {
    console.error("❌ checkMultiInvoiceSessionStatus:", err.message);
    return "unknown";
  }
}

async function expireMultiInvoiceSession(sessionId, connectAccountId = null) {
  try {
    const options = connectAccountId ? { stripeAccount: connectAccountId } : {};
    await stripe.checkout.sessions.expire(sessionId, options);
    return true;
  } catch (err) {
    console.error("❌ expireMultiInvoiceSession:", err.message);
    return false;
  }
}

module.exports = {
  createMultiInvoiceCheckoutSession,
  checkMultiInvoiceSessionStatus,
  expireMultiInvoiceSession,
  estimateStripeFeeFromDollars,
  convertToCents,
};
