const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const { response } = require("../../utils/response");
const {
  dispatchOrderEmail,
} = require("../../services/orderEmailDispatchService");

function buildDedupeKey({ orderId, orderType, emailType }) {
  const normalizedOrderType =
    orderType === "local-partner" ? "local-partner" : "customer";
  return `${normalizedOrderType}:${Number(orderId)}:${emailType}`;
}

/**
 * Keep first occurrence of each orderId + orderType + emailType; drop later duplicates.
 * @returns {{ sanitized: object[], removedDuplicates: object[] }}
 */
function dedupeOrdersToSentEmail(ordersToSentEmail) {
  const seen = new Set();
  const sanitized = [];
  const removedDuplicates = [];

  ordersToSentEmail.forEach((item, index) => {
    const key = buildDedupeKey({
      orderId: item?.orderId,
      orderType: item?.orderType,
      emailType: item?.emailType,
    });

    if (seen.has(key)) {
      removedDuplicates.push({
        orderId: item?.orderId != null ? Number(item.orderId) : null,
        orderType: item?.orderType || null,
        emailType: item?.emailType || null,
        index,
      });
      return;
    }

    seen.add(key);
    sanitized.push(item);
  });

  return { sanitized, removedDuplicates };
}

/**
 * POST /api/v1/admin/order-management/bulk-email-helper
 * Body: { ordersToSentEmail: [{ orderId, orderType, emailType }, ...] }
 */
exports.bulkEmailHelper = catchAsync(async (req, res, next) => {
  const ordersToSentEmail = req.body?.ordersToSentEmail;

  if (!Array.isArray(ordersToSentEmail) || ordersToSentEmail.length === 0) {
    return next(
      new AppError("ordersToSentEmail must be a non-empty array", 400),
    );
  }

  const { sanitized, removedDuplicates } =
    dedupeOrdersToSentEmail(ordersToSentEmail);

  const results = [];

  for (const item of sanitized) {
    const orderId = item?.orderId;
    const orderType = item?.orderType;
    const emailType = item?.emailType;

    try {
      const outcome = await dispatchOrderEmail({
        orderId,
        orderType,
        emailType,
      });
      results.push({
        orderId: orderId != null ? Number(orderId) : null,
        orderType: orderType || null,
        emailType: emailType || null,
        success: outcome.success && !outcome.skipped,
        skipped: Boolean(outcome.skipped),
        error: outcome.error || (outcome.skipped ? "disabled_by_settings" : null),
      });
    } catch (err) {
      results.push({
        orderId: orderId != null ? Number(orderId) : null,
        orderType: orderType || null,
        emailType: emailType || null,
        success: false,
        error: err?.message || String(err),
      });
    }
  }

  const summary = {
    totalRequested: ordersToSentEmail.length,
    totalProcessed: results.length,
    duplicatesRemoved: removedDuplicates.length,
    success: results.filter((r) => r.success).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => r.success === false && !r.skipped).length,
  };

  const output = response({
    data: {
      summary,
      removedDuplicates,
      results,
    },
  });

  res.status(200).json(output);
});
