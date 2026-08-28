const { Op } = require("sequelize");
const { order, partnerOrder, emailLog } = require("../models");
const { withDbLock } = require("../utils/dbLock");
const {
  dataForEmailAndNotifications,
} = require("../utils/emailsNotificationsData");
const supplierNewOrder = require("../helper/supplierNewOrder");

async function getLatestSupplierLog({ orderId, orderType }) {
  const where = {
    emailType: "supplier_new_order",
    orderType,
  };
  if (orderType === "local-partner") {
    where.partnerOrderId = orderId;
  } else {
    where.orderId = orderId;
  }
  return emailLog.findOne({
    where,
    order: [["sentAt", "DESC"]],
    raw: true,
  });
}

function hoursDiff(fromDate, toDate = new Date()) {
  const from = new Date(fromDate).getTime();
  const to = new Date(toDate).getTime();
  return (to - from) / (1000 * 60 * 60);
}

async function processCandidate({ orderId, orderType, minHours }) {
  const latestLog = await getLatestSupplierLog({ orderId, orderType });
  if (!latestLog) return { action: "skipped", reason: "no_supplier_log" };
  if (latestLog.emailSent !== "Success") {
    return { action: "skipped", reason: "latest_send_not_success" };
  }
  if ((latestLog.openCount || 0) > 0 || latestLog.firstOpenedAt) {
    return { action: "skipped", reason: "opened_already" };
  }

  const detailsResponse = await dataForEmailAndNotifications(
    orderId,
    orderType,
  );
  if (!detailsResponse?.details) {
    return { action: "skipped", reason: "order_not_found" };
  }
  const details = detailsResponse.details;
  if (Number(details.statusId) !== 2) {
    return { action: "skipped", reason: "status_not_2" };
  }
  if (!details?.supplierEmail) {
    return { action: "skipped", reason: "no_supplier_email" };
  }

  const referenceTime =
    details.supplierEmailLastSentAt || latestLog.sentAt || latestLog.createdAt;
  if (!referenceTime) {
    return { action: "skipped", reason: "no_last_send_reference" };
  }
  if (hoursDiff(referenceTime) < minHours) {
    return { action: "skipped", reason: "less_than_required_hours" };
  }

  await supplierNewOrder({
    email: details.supplierEmail,
    data: details,
    isRetry: true,
  });
  return { action: "resent" };
}

async function resendUnopenedSupplierEmails({
  minHours = 24,
  maxRetry = 3,
  lockName = "supplier_unopened_email_resend_job",
  lockTimeoutSec = 3,
} = {}) {
  return withDbLock(lockName, lockTimeoutSec, async () => {
    const summary = {
      scanned: 0,
      eligibleChecked: 0,
      resentSuccess: 0,
      resentFailed: 0,
      skipped: {
        no_supplier_log: 0,
        latest_send_not_success: 0,
        opened_already: 0,
        order_not_found: 0,
        status_not_2: 0,
        no_supplier_email: 0,
        no_last_send_reference: 0,
        less_than_required_hours: 0,
        error: 0,
      },
    };

    const thresholdDate = new Date(Date.now() - minHours * 60 * 60 * 1000);

    const [orderRows, partnerRows] = await Promise.all([
      order.findAll({
        where: {
          statusId: 2,
          supplierEmailSendCount: { [Op.lt]: maxRetry },
          supplierEmailLastSentAt: { [Op.lte]: thresholdDate },
        },
        attributes: [
          "id",
          "statusId",
          "supplierEmailSendCount",
          "supplierEmailLastSentAt",
        ],
        raw: true,
      }),
      partnerOrder.findAll({
        where: {
          statusId: 2,
          supplierEmailSendCount: { [Op.lt]: maxRetry },
          supplierEmailLastSentAt: { [Op.lte]: thresholdDate },
        },
        attributes: [
          "id",
          "statusId",
          "supplierEmailSendCount",
          "supplierEmailLastSentAt",
        ],
        raw: true,
      }),
    ]);

    const candidates = [
      ...orderRows.map((r) => ({ orderId: r.id, orderType: "customer" })),
      ...partnerRows.map((r) => ({
        orderId: r.id,
        orderType: "local-partner",
      })),
    ];
    summary.scanned = candidates.length;

    for (const candidate of candidates) {
      summary.eligibleChecked += 1;
      try {
        const result = await processCandidate({
          orderId: candidate.orderId,
          orderType: candidate.orderType,
          minHours,
        });
        if (result.action === "resent") {
          summary.resentSuccess += 1;
        } else {
          summary.skipped[result.reason] =
            (summary.skipped[result.reason] || 0) + 1;
        }
      } catch (err) {
        summary.resentFailed += 1;
        summary.skipped.error += 1;
        // Keep processing other rows even if one fails.
        console.error(
          `[supplierResend] Failed for ${candidate.orderType} order ${candidate.orderId}:`,
          err.message,
        );
      }
    }

    return summary;
  });
}

module.exports = { resendUnopenedSupplierEmails };
