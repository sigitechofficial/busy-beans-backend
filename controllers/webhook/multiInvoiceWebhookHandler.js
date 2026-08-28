const { STRIPE_SECRET_KEY } = process.env;
const stripe = require("stripe")(STRIPE_SECRET_KEY);
const { literal } = require("sequelize");

const {
  order,
  user,
  employee,
  checkoutBatch,
  checkoutBatchOrder,
} = require("../../models");

const {
  getBatchWithOrders,
  allocateStripeFee,
} = require("../../services/multiInvoiceCheckoutService");

const {
  syncInvoiceOnQuikBooks,
} = require("../../services/syncInvoiceOnQBO");
const { syncPaymentToQuickBooks } = require("../../services/paymentSyncService");

const {
  calculateAndTransferEmployeeCommissionWithData,
} = require("../../utils/employeeCommissionUtils");
const {
  calculateAndPayoutDirectPartnerEmployeeCommission,
} = require("../../utils/directPartnerEmployeePayoutUtils");

const { multiInvoicePaidEvent } = require("../events/multiInvoicePaidEvent");

function resolveInvoiceNumbersText(batch, sessionMetadata = {}) {
  let nums = batch?.invoiceNumbers;

  if (typeof nums === "string") {
    try {
      nums = JSON.parse(nums);
    } catch {
      return nums.trim();
    }
  }

  if (Array.isArray(nums)) {
    return nums.filter(Boolean).join(", ");
  }

  const fromBatchOrders = (batch?.batchOrders || [])
    .map((line) => line.invoiceNumber)
    .filter(Boolean);
  if (fromBatchOrders.length) {
    return fromBatchOrders.join(", ");
  }

  if (sessionMetadata?.invoiceNumbers) {
    return String(sessionMetadata.invoiceNumbers);
  }

  return "";
}

async function runMultiInvoicePostPaymentSteps({
  session,
  batch,
  checkoutBatchId,
  metadata,
}) {
  const invoiceNumbersText = resolveInvoiceNumbersText(batch, metadata);

  try {
    await updateConnectedAccountChargeDescription({
      session,
      batch,
      invoiceNumbersText,
    });
  } catch (chargeErr) {
    console.error(
      "[MULTI-INVOICE-WEBHOOK] Connected charge update failed:",
      chargeErr.message,
    );
  }

  try {
    await multiInvoicePaidEvent({ checkoutBatchId });
  } catch (emailErr) {
    console.error("[MULTI-INVOICE-WEBHOOK] Paid email failed:", emailErr.message);
  }
}

async function loadOrderForWebhookUpdate(orderId) {
  return order.findOne({
    where: { id: orderId },
    include: [
      {
        model: user,
        attributes: ["id", "employeeId", "salesRepId"],
        include: [
          {
            model: employee,
            attributes: [
              "id",
              "commissionPercentage",
              "stripeConnectAccountId",
              "employeeOf",
            ],
            required: false,
          },
        ],
      },
    ],
    attributes: [
      "id",
      "subTotal",
      "invoiceNumber",
      "salesRepId",
      [
        literal(
          `(SELECT salesReps.partnerType FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`,
        ),
        "partnerType",
      ],
      "employeeTransferId",
      "invoiceDate",
      "quickBooksInvoiceId",
      "quickBooksInvoiceIdPartner",
      "quickBooksPaymentId",
      "quickBooksPaymentIdPartner",
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
  });
}

async function updateConnectedAccountChargeDescription({
  session,
  batch,
  invoiceNumbersText,
}) {
  if (batch.batchContext === "direct-partner") return;

  if (!session?.payment_intent) return;

  const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
    expand: ["latest_charge"],
  });

  const platformChargeId =
    pi.latest_charge ||
    (typeof pi.latest_charge === "object" ? pi.latest_charge?.id : null);

  if (!batch.connectAccountId || !platformChargeId) return;

  const platformCharge = await stripe.charges.retrieve(platformChargeId, {
    expand: ["transfer", "balance_transaction"],
  });

  const transferId =
    typeof platformCharge.transfer === "string"
      ? platformCharge.transfer
      : platformCharge.transfer?.id;

  if (!transferId) return;

  const bt = platformCharge.balance_transaction;
  const feeMinor = typeof bt === "object" ? bt.fee : null;
  const feeCurrency = (
    typeof bt === "object" ? bt.currency : pi.currency || "usd"
  )?.toLowerCase();

  const formatAmount = (minor, currency = "usd") => {
    if (typeof minor !== "number") return "";
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

  const transfer = await stripe.transfers.retrieve(transferId);
  const connectedAccountId = transfer?.destination;
  const destinationPaymentId = transfer?.destination_payment;

  if (!connectedAccountId || !destinationPaymentId) return;

  const description = `Payment for invoices ${invoiceNumbersText}${feeText} — Busy Bean Coffee Inc.`;

  await stripe.charges.update(
    destinationPaymentId,
    {
      description,
      metadata: {
        checkoutBatchId: String(batch.id),
        invoiceNumbers: invoiceNumbersText,
        type: "multi-checkout-session",
        platform: "Busy Bean Coffee Inc.",
        multipleInvoices: "yes",
      },
    },
    { stripeAccount: connectedAccountId },
  );
}

/**
 * Handle checkout.session.completed for combined multi-invoice payments.
 */
async function onMultiInvoiceCheckoutCompleted(event) {
  const session = event.data.object;
  const metadata = session.metadata || session.payment_intent_data?.metadata || {};

  if (metadata.multipleInvoices !== "yes") {
    return false;
  }

  const checkoutBatchId = Number(metadata.checkoutBatchId);
  if (!checkoutBatchId) {
    console.error("[MULTI-INVOICE-WEBHOOK] Missing checkoutBatchId in metadata");
    return false;
  }

  const batch = await getBatchWithOrders(checkoutBatchId);
  if (!batch) {
    console.error(`[MULTI-INVOICE-WEBHOOK] Batch ${checkoutBatchId} not found`);
    return false;
  }

  if (batch.status === "paid") {
    console.log(
      `[MULTI-INVOICE-WEBHOOK] Batch ${checkoutBatchId} already paid — running post-payment steps only`,
    );
    await runMultiInvoicePostPaymentSteps({
      session,
      batch,
      checkoutBatchId,
      metadata,
    });
    return true;
  }

  try {
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  let actualStripeFeeDollars = parseFloat(batch.totalStripeFeeEstimate || 0);

  if (paymentIntentId) {
    try {
      const requestOptions =
        batch.batchContext === "direct-partner" && batch.connectAccountId
          ? { stripeAccount: batch.connectAccountId }
          : undefined;

      const pi = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        { expand: ["latest_charge.balance_transaction"] },
        requestOptions,
      );
      const charge = pi.latest_charge;
      const bt =
        typeof charge === "object" ? charge.balance_transaction : null;
      if (bt && typeof bt === "object" && typeof bt.fee === "number") {
        actualStripeFeeDollars = bt.fee / 100;
      }
    } catch (feeErr) {
      console.warn(
        "[MULTI-INVOICE-WEBHOOK] Could not read actual Stripe fee:",
        feeErr.message,
      );
    }
  }

  const allocatedLines = allocateStripeFee(
    actualStripeFeeDollars,
    batch.batchOrders || [],
  );

  await checkoutBatch.update(
    {
      status: "paid",
      paymentIntentId: paymentIntentId || batch.paymentIntentId,
      stripeSessionId: session.id,
    },
    { where: { id: checkoutBatchId } },
  );

  for (const line of allocatedLines) {
    const orderRow = await loadOrderForWebhookUpdate(line.orderId);
    if (!orderRow) continue;

    const orderPlaced = JSON.parse(JSON.stringify(orderRow));
    let employeeCommissionData = {};

    const isDirectPartnerOrder =
      !!orderPlaced?.salesRepId &&
      orderPlaced?.partnerType === "direct-partner";

    if (isDirectPartnerOrder) {
      const payoutResult =
        await calculateAndPayoutDirectPartnerEmployeeCommission({
          orderId: orderPlaced.id,
          triggerSource: "webhook-multi-invoice-paid",
        });

      if (payoutResult?.success) {
        employeeCommissionData = {
          employeeId: payoutResult.employeeId,
          employeeOf: "direct-partner",
          AppliedEmployeeCommisionPercentage:
            payoutResult.commissionPercentage,
          employeeCommisionAmount: payoutResult.commissionAmount,
        };
      }
    } else {
      const commissionResult =
        await calculateAndTransferEmployeeCommissionWithData({
          orderData: orderRow,
          invoiceId: session.id,
          paymentIntentId,
          employeeOf: "admin",
        });

      if (commissionResult?.success) {
        employeeCommissionData = {
          employeeId: commissionResult.employeeId,
          employeeOf: "admin",
          AppliedEmployeeCommisionPercentage:
            commissionResult.commissionPercentage,
          employeeCommisionAmount: commissionResult.employeeCommissionAmount,
          employeeTransferId: commissionResult.transferId || null,
        };
      }
    }

    const orderUpdatePayload = {
      paymentMethod: "card",
      localPatnerCommission: orderPlaced?.totalSalerCommission || 0,
      adminReceivableAmount: orderPlaced?.adminEarnings || 0,
      adminReceivableStatus: true,
      paymentStatus: "done",
      invoicePaidDate: Date.now(),
      pulloutDate: Date.now(),
      paymentIntentId,
      invoiceId: session.id,
      proportionalStripeFee: line.proportionalStripeFee,
      ...employeeCommissionData,
    };

    if (!orderPlaced.invoiceDate) {
      orderUpdatePayload.invoiceDate = new Date();
    }

    await order.update(orderUpdatePayload, { where: { id: orderPlaced.id } });

    await checkoutBatchOrder.update(
      {
        proportionalStripeFee: line.proportionalStripeFee,
        paidAt: new Date(),
      },
      {
        where: {
          checkoutBatchId,
          orderId: line.orderId,
        },
      },
    );
  }

  for (const line of allocatedLines) {
    const orderPlaced = await order.findOne({
      where: { id: line.orderId },
      attributes: [
        "id",
        "quickBooksInvoiceId",
        "quickBooksInvoiceIdPartner",
        "quickBooksPaymentId",
        "quickBooksPaymentIdPartner",
      ],
    });

    if (!orderPlaced) continue;

    try {
      if (
        orderPlaced.quickBooksInvoiceId &&
        (!orderPlaced.quickBooksPaymentId ||
          !orderPlaced.quickBooksPaymentIdPartner)
      ) {
        await syncPaymentToQuickBooks({
          orderId: orderPlaced.id,
          orderType: "customer",
        });
      } else if (
        !orderPlaced.quickBooksInvoiceId ||
        !orderPlaced.quickBooksInvoiceIdPartner
      ) {
        await syncInvoiceOnQuikBooks({
          orderId: orderPlaced.id,
          orderType: "customer",
        });
      }
    } catch (qboErr) {
      console.error(
        `[MULTI-INVOICE-WEBHOOK] QBO sync failed for order ${line.orderId}:`,
        qboErr.message,
      );
    }
  }

  await runMultiInvoicePostPaymentSteps({
    session,
    batch,
    checkoutBatchId,
    metadata,
  });

  return true;
  } catch (error) {
    console.error("[MULTI-INVOICE-WEBHOOK] Error handling checkout.session.completed:", error);
    return false;
  }
}

module.exports = {
  onMultiInvoiceCheckoutCompleted,
};
