const { Op, literal } = require("sequelize");

const AppError = require("../utils/appError");
const {
  order,
  checkoutBatch,
  checkoutBatchOrder,
  sequelize,
} = require("../models");

const StripeMulti = require("../controllers/stripeMultiInvoiceCheckout");
const StripeLegacy = require("../controllers/stripe");

const MIN_MULTI_INVOICE_COUNT = 2;

function normalizeOrderIds(orderIds) {
  if (!Array.isArray(orderIds) || orderIds.length < MIN_MULTI_INVOICE_COUNT) {
    throw new AppError(
      `Select at least ${MIN_MULTI_INVOICE_COUNT} invoices to pay together.`,
      400,
    );
  }

  const ids = [...new Set(orderIds.map((id) => Number(id)).filter(Boolean))];
  if (ids.length < MIN_MULTI_INVOICE_COUNT) {
    throw new AppError(
      `Select at least ${MIN_MULTI_INVOICE_COUNT} valid invoices.`,
      400,
    );
  }
  return ids.sort((a, b) => a - b);
}

async function loadOrdersForMultiCheckout(orderIds, authenticatedUserId) {
  const rows = await order.findAll({
    where: {
      id: { [Op.in]: orderIds },
      userId: authenticatedUserId,
      deleted: false,
    },
    attributes: [
      "id",
      "userId",
      "salesRepId",
      "totalBill",
      "invoiceNumber",
      "invoiceDate",
      "paymentStatus",
      "paymentIntentId",
      "invoiceId",
      "hostedInvoiceUrl",
      [
        literal(
          `(SELECT salesReps.connectAccountId FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`,
        ),
        "connectAccountId",
      ],
      [
        literal(
          `(SELECT salesReps.partnerType FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`,
        ),
        "partnerType",
      ],
      [
        literal(
          `(SELECT salesReps.email FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`,
        ),
        "patnerEmail",
      ],
      [
        literal(`COALESCE(
         (SELECT SUM(salerCommission)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        "localPatnerCommission",
      ],
      [
        literal(`
          COALESCE(order.totalBill, 0) - COALESCE((
            SELECT SUM(salerCommission)
            FROM items
            WHERE items.orderId = order.id
          ), 0)
        `),
        "adminReceivableAmount",
      ],
      [
        literal(
          `(SELECT users.email FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        "email",
      ],
      [
        literal(
          `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        "companyName",
      ],
      [
        literal(
          `(SELECT users.stripeCustomerId FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        "stripeCustomerId",
      ],
      [
        literal(
          `(SELECT users.stripeCustomerIdForPartner FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        "stripeCustomerIdForPartner",
      ],
    ],
  });

  if (rows.length !== orderIds.length) {
    const found = new Set(rows.map((r) => r.id));
    const missing = orderIds.filter((id) => !found.has(id));
    throw new AppError(
      `Some invoices were not found or do not belong to you: ${missing.join(", ")}`,
      404,
    );
  }

  const ordered = orderIds.map((id) => rows.find((r) => r.id === id));
  return ordered.map((row) => JSON.parse(JSON.stringify(row)));
}

function validateMultiInvoiceHomogeneity(orders) {
  const paid = orders.filter((o) => o.paymentStatus === "done");
  if (paid.length) {
    throw new AppError(
      `These invoices are already paid: ${paid.map((o) => o.invoiceNumber || o.id).join(", ")}`,
      400,
    );
  }


  const userIds = [...new Set(orders.map((o) => String(o.userId)))];
  if (userIds.length !== 1) {
    throw new AppError("All invoices must belong to the same customer.", 400);
  }

  const salesRepKey = (id) => (id == null ? "admin" : String(id));
  const salesRepIds = [...new Set(orders.map((o) => salesRepKey(o.salesRepId)))];
  if (salesRepIds.length !== 1) {
    throw new AppError(
      "All invoices must be admin-only or all under the same local partner.",
      400,
    );
  }

  const connectKeys = [
    ...new Set(orders.map((o) => o.connectAccountId || "none")),
  ];
  if (connectKeys.length !== 1) {
    throw new AppError(
      "All invoices must share the same partner payment account.",
      400,
    );
  }

  const partnerTypes = [
    ...new Set(orders.map((o) => o.partnerType || "admin")),
  ];
  if (partnerTypes.length !== 1) {
    throw new AppError("All invoices must have the same partner type.", 400);
  }

  const invalidTotals = orders.filter(
    (o) => !o.totalBill || parseFloat(o.totalBill) <= 0,
  );
  if (invalidTotals.length) {
    throw new AppError("Each invoice must have a positive total amount.", 400);
  }
}

function computeBatchTotals(orders) {
  let grandTotal = 0;
  let totalAdminReceivable = 0;
  let totalPartnerCommission = 0;
  let totalStripeFeeEstimate = 0;

  const lines = orders.map((o) => {
    const lineAmount = parseFloat(o.totalBill || 0);
    const adminReceivableAmount = parseFloat(o.adminReceivableAmount || 0);
    const localPatnerCommission = parseFloat(o.localPatnerCommission || 0);
    const feeEstimate = StripeMulti.estimateStripeFeeFromDollars(lineAmount);

    grandTotal += lineAmount;
    totalAdminReceivable += adminReceivableAmount;
    totalPartnerCommission += localPatnerCommission;
    totalStripeFeeEstimate += feeEstimate;

    return {
      orderId: o.id,
      invoiceNumber: o.invoiceNumber,
      lineAmount,
      adminReceivableAmount,
      localPatnerCommission,
      proportionalStripeFeeEstimate: feeEstimate,
    };
  });

  return {
    lines,
    grandTotal,
    totalAdminReceivable,
    totalPartnerCommission,
    totalStripeFeeEstimate,
  };
}

function resolveBatchContext(orders) {
  const first = orders[0];
  if (!first.salesRepId) return "admin";
  if (first.partnerType === "direct-partner") return "direct-partner";
  return "partner";
}

function allocateStripeFee(actualFeeDollars, lines) {
  const total = lines.reduce((s, l) => s + parseFloat(l.lineAmount || 0), 0);
  if (!total || actualFeeDollars == null) {
    return lines.map((l) => ({
      ...l,
      proportionalStripeFee: l.proportionalStripeFeeEstimate,
    }));
  }

  return lines.map((l) => ({
    ...l,
    proportionalStripeFee:
      Math.round(
        (actualFeeDollars * (parseFloat(l.lineAmount) / total) + Number.EPSILON) *
          100,
      ) / 100,
  }));
}

async function findReusableOpenBatch(orderIds, userId) {
  const openBatches = await checkoutBatch.findAll({
    where: { userId, status: "open" },
    include: [{ model: checkoutBatchOrder, as: "batchOrders" }],
    order: [["id", "DESC"]],
  });

  const targetKey = orderIds.join(",");

  for (const batch of openBatches) {
    const batchOrderIds = (batch.batchOrders || [])
      .map((bo) => bo.orderId)
      .sort((a, b) => a - b);
    if (batchOrderIds.join(",") !== targetKey) continue;

    if (!batch.stripeSessionId) continue;

    const status = await StripeMulti.checkMultiInvoiceSessionStatus(
      batch.stripeSessionId,
      batch.connectAccountId || null,
    );

    if (status === "paid") {
      await batch.update({ status: "paid" });
      continue;
    }

    if (status === "open") {
      return JSON.parse(JSON.stringify(batch));
    }

    await batch.update({ status: "expired" });
  }

  return null;
}

async function expireStaleSessionsForOrders(orders) {
  for (const o of orders) {
    if (!o.invoiceId || !String(o.invoiceId).startsWith("cs_")) continue;

    const status = await StripeLegacy.checkCheckoutSessionStatus(o.invoiceId);
    if (status === "open") {
      await StripeLegacy.blockCheckoutSession(o.invoiceId);
    }
  }
}

async function createMultiInvoiceCheckout({ orderIds, authenticatedUserId }) {
  const normalizedIds = normalizeOrderIds(orderIds);
  const orders = await loadOrdersForMultiCheckout(
    normalizedIds,
    authenticatedUserId,
  );
  validateMultiInvoiceHomogeneity(orders);

  const reusable = await findReusableOpenBatch(
    normalizedIds,
    authenticatedUserId,
  );
  if (reusable?.hostedInvoiceUrl) {
    return {
      checkoutBatchId: reusable.id,
      hostedInvoiceUrl: reusable.hostedInvoiceUrl,
      grandTotal: parseFloat(reusable.grandTotal),
      invoices: (reusable.batchOrders || []).map((bo) => ({
        orderId: bo.orderId,
        invoiceNumber: bo.invoiceNumber,
        amount: parseFloat(bo.lineAmount),
      })),
      reused: true,
    };
  }

  await expireStaleSessionsForOrders(orders);

  const totals = computeBatchTotals(orders);
  const batchContext = resolveBatchContext(orders);
  const first = orders[0];

  const transaction = await sequelize.transaction();

  try {
    const batch = await checkoutBatch.create(
      {
        userId: authenticatedUserId,
        salesRepId: first.salesRepId || null,
        connectAccountId: first.connectAccountId || null,
        partnerType: first.partnerType || null,
        batchContext,
        grandTotal: totals.grandTotal,
        totalAdminReceivable: totals.totalAdminReceivable,
        totalPartnerCommission: totals.totalPartnerCommission,
        totalStripeFeeEstimate: totals.totalStripeFeeEstimate,
        status: "open",
        invoiceNumbers: orders.map((o) => o.invoiceNumber),
        orderIdsSnapshot: normalizedIds,
      },
      { transaction },
    );

    await checkoutBatchOrder.bulkCreate(
      totals.lines.map((line) => ({
        checkoutBatchId: batch.id,
        ...line,
      })),
      { transaction },
    );

    const session = await StripeMulti.createMultiInvoiceCheckoutSession({
      orders,
      batch,
    });

    await batch.update(
      {
        stripeSessionId: session.invoiceId,
        hostedInvoiceUrl: session.hostedInvoiceUrl,
      },
      { transaction },
    );

    await order.update(
      {
        invoiceId: session.invoiceId,
        hostedInvoiceUrl: session.hostedInvoiceUrl,
        proportionalStripeFee: session.proportionalStripeFee,
      },
      { where: { id: { [Op.in]: normalizedIds } }, transaction },
    );

    await transaction.commit();

    return {
      checkoutBatchId: batch.id,
      hostedInvoiceUrl: session.hostedInvoiceUrl,
      grandTotal: totals.grandTotal,
      invoices: totals.lines.map((line) => ({
        orderId: line.orderId,
        invoiceNumber: line.invoiceNumber,
        amount: line.lineAmount,
      })),
      reused: false,
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function getBatchWithOrders(checkoutBatchId) {
  const batch = await checkoutBatch.findByPk(checkoutBatchId, {
    include: [{ model: checkoutBatchOrder, as: "batchOrders" }],
  });
  if (!batch) return null;
  return JSON.parse(JSON.stringify(batch));
}

module.exports = {
  normalizeOrderIds,
  loadOrdersForMultiCheckout,
  validateMultiInvoiceHomogeneity,
  computeBatchTotals,
  allocateStripeFee,
  createMultiInvoiceCheckout,
  getBatchWithOrders,
};
