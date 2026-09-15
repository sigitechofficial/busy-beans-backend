const { Op, fn, col, literal } = require("sequelize");
const {
  order,
  partnerOrder,
  salesRep,
  account,
  dailyDigestSend,
} = require("../models");
const sendAdminDailyEodDigest = require("../helper/dailyEodDigestAdmin");
const sendPartnerDailyEodDigest = require("../helper/dailyEodDigestPartner");
const {
  canSendEmail,
  logEmailSkipped,
  hqPerson,
} = require("../utils/emailSendGate");

const FLORIDA_TIMEZONE = "America/New_York";
/** Pending claim older than this can be reclaimed after a crashed job. */
const STALE_PENDING_MS = 30 * 60 * 1000;

function getBusinessDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FLORIDA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDisplayDate(reportDate) {
  try {
    const d = new Date(`${reportDate}T12:00:00`);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: FLORIDA_TIMEZONE,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  } catch {
    return String(reportDate);
  }
}

function toMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function emptyMetrics() {
  return { count: 0, totalBill: 0 };
}

function emptyReceivableMetrics() {
  return { count: 0, totalBill: 0, adminReceivable: 0 };
}

function emptyPartnerPaymentMetrics() {
  return { count: 0, totalBill: 0, commission: 0 };
}

/**
 * Shared base filters for customer / partner wholesale orders.
 */
function baseOrderWhere(extra = {}) {
  return {
    deleted: false,
    statusId: { [Op.ne]: 6 },
    ...extra,
  };
}

function assertReportDate(reportDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(reportDate))) {
    throw new Error("Invalid reportDate. Expected YYYY-MM-DD.");
  }
  return String(reportDate);
}

/**
 * Standard payments date:
 * invoicePaidDate if present, else on.
 */
function standardPaymentDateMatch(reportDate) {
  const d = assertReportDate(reportDate);
  return literal(`COALESCE(\`invoicePaidDate\`, \`on\`) = '${d}'`);
}

/**
 * Admin dropship partner payments date:
 * pulloutDate if present, else invoicePaidDate, else on.
 */
function dropshipAdminPaymentDateMatch(reportDate) {
  const d = assertReportDate(reportDate);
  return literal(
    `COALESCE(\`pulloutDate\`, \`invoicePaidDate\`, \`on\`) = '${d}'`,
  );
}

async function sumOrderMetrics(model, where) {
  const row = await model.findOne({
    where,
    attributes: [
      [fn("COUNT", col("id")), "count"],
      [fn("COALESCE", fn("SUM", col("totalBill")), 0), "totalBill"],
    ],
    raw: true,
  });
  return {
    count: Number(row?.count || 0),
    totalBill: toMoney(row?.totalBill),
  };
}

/**
 * Own-customer / partner-restock / partner-customer payments:
 * paymentStatus=done AND COALESCE(invoicePaidDate, on)=reportDate
 */
async function sumStandardPaidMetrics(model, reportDate, extra = {}) {
  return sumOrderMetrics(
    model,
    baseOrderWhere({
      paymentStatus: "done",
      ...extra,
      [Op.and]: [standardPaymentDateMatch(reportDate)],
    }),
  );
}

/**
 * Admin email — dropship partner customer payments:
 * paymentStatus=done
 * adminReceivableAmount > 0
 * COALESCE(pulloutDate, invoicePaidDate, on)=reportDate
 */
async function sumPaidDropshipMetrics(reportDate, salesRepIds) {
  if (!salesRepIds.length) return emptyReceivableMetrics();

  const row = await order.findOne({
    where: baseOrderWhere({
      paymentStatus: "done",
      adminReceivableAmount: { [Op.gt]: 0 },
      salesRepId: { [Op.in]: salesRepIds },
      [Op.and]: [dropshipAdminPaymentDateMatch(reportDate)],
    }),
    attributes: [
      [fn("COUNT", col("id")), "count"],
      [fn("COALESCE", fn("SUM", col("totalBill")), 0), "totalBill"],
      [
        literal(`COALESCE(SUM(COALESCE(adminReceivableAmount,
          totalBill - COALESCE(localPatnerCommission, 0))), 0)`),
        "adminReceivable",
      ],
    ],
    raw: true,
  });

  return {
    count: Number(row?.count || 0),
    totalBill: toMoney(row?.totalBill),
    adminReceivable: toMoney(row?.adminReceivable),
  };
}

async function sumPartnerPaidMetrics(reportDate, salesRepId) {
  const row = await order.findOne({
    where: baseOrderWhere({
      paymentStatus: "done",
      salesRepId,
      [Op.and]: [standardPaymentDateMatch(reportDate)],
    }),
    attributes: [
      [fn("COUNT", col("id")), "count"],
      [fn("COALESCE", fn("SUM", col("totalBill")), 0), "totalBill"],
      [
        fn("COALESCE", fn("SUM", col("localPatnerCommission")), 0),
        "commission",
      ],
    ],
    raw: true,
  });

  return {
    count: Number(row?.count || 0),
    totalBill: toMoney(row?.totalBill),
    commission: toMoney(row?.commission),
  };
}

async function getDropshipPartnerIds() {
  const rows = await salesRep.findAll({
    where: {
      deleted: false,
      partnerType: "dropship-partner",
    },
    attributes: ["id"],
    raw: true,
  });
  return rows.map((r) => r.id).filter(Boolean);
}

/**
 * Admin digest aggregates for one business day.
 */
async function aggregateAdminDigest(reportDate) {
  const dropshipIds = await getDropshipPartnerIds();

  const [ownOrders, ownPayments, dropshipOrders, dropshipPayments, restockOrders, restockPayments] =
    await Promise.all([
      sumOrderMetrics(
        order,
        baseOrderWhere({
          on: reportDate,
          salesRepId: { [Op.is]: null },
        }),
      ),
      sumStandardPaidMetrics(order, reportDate, {
        salesRepId: { [Op.is]: null },
      }),
      dropshipIds.length
        ? sumOrderMetrics(
            order,
            baseOrderWhere({
              on: reportDate,
              salesRepId: { [Op.in]: dropshipIds },
            }),
          )
        : Promise.resolve(emptyMetrics()),
      sumPaidDropshipMetrics(reportDate, dropshipIds),
      sumOrderMetrics(
        partnerOrder,
        baseOrderWhere({ on: reportDate }),
      ),
      sumStandardPaidMetrics(partnerOrder, reportDate),
    ]);

  return {
    reportDate,
    displayDate: formatDisplayDate(reportDate),
    timezone: FLORIDA_TIMEZONE,
    ownCustomers: {
      orders: ownOrders,
      payments: ownPayments,
    },
    dropshipPartnerCustomers: {
      orders: dropshipOrders,
      payments: {
        count: dropshipPayments.count,
        totalBill: dropshipPayments.totalBill,
        adminReceivable: dropshipPayments.adminReceivable,
      },
    },
    partnerRestocks: {
      orders: restockOrders,
      payments: restockPayments,
    },
  };
}

/**
 * Partner digest aggregates — scoped strictly to one salesRepId.
 */
async function aggregatePartnerDigest(salesRepId, reportDate) {
  const [ordersReceived, payments] = await Promise.all([
    sumOrderMetrics(
      order,
      baseOrderWhere({
        on: reportDate,
        salesRepId,
      }),
    ),
    sumPartnerPaidMetrics(reportDate, salesRepId),
  ]);

  return {
    reportDate,
    displayDate: formatDisplayDate(reportDate),
    timezone: FLORIDA_TIMEZONE,
    orders: ordersReceived,
    payments: {
      count: payments.count,
      totalBill: payments.totalBill,
      commission: payments.commission,
    },
  };
}

/**
 * Claim a unique send slot for (reportDate, recipientType, recipientId).
 * Prevents double-send even under concurrent Lambda invocations.
 */
async function claimDigestSlot({
  reportDate,
  recipientType,
  recipientId,
  forceRetryFailed = true,
}) {
  const existing = await dailyDigestSend.findOne({
    where: { reportDate, recipientType, recipientId },
  });

  if (existing) {
    if (existing.status === "sent") {
      return { claimed: false, reason: "already_sent", row: existing };
    }

    if (existing.status === "pending") {
      const ageMs = Date.now() - new Date(existing.updatedAt || existing.createdAt).getTime();
      if (ageMs < STALE_PENDING_MS) {
        return { claimed: false, reason: "in_progress", row: existing };
      }
      await existing.update({ status: "pending", errorMessage: null });
      return { claimed: true, reason: "reclaim_stale_pending", row: existing };
    }

    if (existing.status === "failed") {
      if (!forceRetryFailed) {
        return { claimed: false, reason: "failed_not_retried", row: existing };
      }
      await existing.update({ status: "pending", errorMessage: null });
      return { claimed: true, reason: "retry_failed", row: existing };
    }
  }

  try {
    const row = await dailyDigestSend.create({
      reportDate,
      recipientType,
      recipientId,
      status: "pending",
    });
    return { claimed: true, reason: "new", row };
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return { claimed: false, reason: "race_duplicate", row: null };
    }
    throw err;
  }
}

async function markDigestSent(row, recipients) {
  await row.update({
    status: "sent",
    recipients: Array.isArray(recipients) ? recipients.join(", ") : String(recipients || ""),
    sentAt: new Date(),
    errorMessage: null,
  });
}

async function markDigestFailed(row, errorMessage) {
  await row.update({
    status: "failed",
    errorMessage: String(errorMessage || "Unknown error").slice(0, 4000),
  });
}

async function resolveAdminRecipient() {
  const adm = await account.findOne({
    where: { deleted: false },
    attributes: ["id", "email", "supportEmail", "name"],
    order: [["id", "ASC"]],
  });
  if (!adm) return null;
  const email = adm.supportEmail || adm.email;
  if (!email) return null;
  return { id: adm.id, email, name: adm.name || "Administrator" };
}

async function listActivePartners() {
  return salesRep.findAll({
    where: {
      deleted: false,
      status: true,
    },
    attributes: ["id", "email", "srName", "partnerType"],
    order: [["id", "ASC"]],
  });
}

async function sendAdminDigestSafe({ reportDate, forceRetryFailed }) {
  const admin = await resolveAdminRecipient();
  if (!admin) {
    return {
      status: "skipped",
      reason: "no_admin_email",
    };
  }

  const allowed = await canSendEmail({
    ...hqPerson(),
    emailType: "daily_eod_report_admin",
  });
  if (!allowed) {
    await logEmailSkipped({
      emailType: "daily_eod_report_admin",
      recipients: admin.email,
    });
    return {
      status: "skipped",
      reason: "disabled_by_settings",
      recipientId: admin.id,
      email: admin.email,
    };
  }

  const claim = await claimDigestSlot({
    reportDate,
    recipientType: "admin",
    recipientId: admin.id,
    forceRetryFailed,
  });

  if (!claim.claimed) {
    return {
      status: "skipped",
      reason: claim.reason,
      recipientId: admin.id,
      email: admin.email,
    };
  }

  let emailed = false;
  try {
    const digest = await aggregateAdminDigest(reportDate);
    await sendAdminDailyEodDigest({
      email: admin.email,
      adminName: admin.name,
      digest,
    });
    emailed = true;
    await markDigestSent(claim.row, admin.email);
    return {
      status: "sent",
      reason: claim.reason,
      recipientId: admin.id,
      email: admin.email,
    };
  } catch (err) {
    console.error("[dailyEodDigest] Admin send failed:", err.message);
    if (emailed) {
      // Email already delivered — never leave slot as pending/failed (would risk a resend).
      try {
        await markDigestSent(claim.row, admin.email);
      } catch (markErr) {
        console.error(
          "[dailyEodDigest] CRITICAL: admin digest emailed but claim not marked sent:",
          markErr.message,
        );
      }
      return {
        status: "sent",
        reason: "sent_claim_mark_warning",
        recipientId: admin.id,
        email: admin.email,
      };
    }
    try {
      await markDigestFailed(claim.row, err.message);
    } catch (markErr) {
      console.error(
        "[dailyEodDigest] Failed to mark admin claim failed:",
        markErr.message,
      );
    }
    return {
      status: "failed",
      reason: err.message,
      recipientId: admin.id,
      email: admin.email,
    };
  }
}

async function sendPartnerDigestSafe({ partner, reportDate, forceRetryFailed }) {
  if (!partner?.email) {
    return {
      status: "skipped",
      reason: "no_partner_email",
      recipientId: partner?.id,
    };
  }

  const allowed = await canSendEmail({
    recipientType: "partner",
    recipientId: partner.id,
    emailType: "daily_eod_report",
  });
  if (!allowed) {
    await logEmailSkipped({
      emailType: "daily_eod_report",
      recipients: partner.email,
    });
    return {
      status: "skipped",
      reason: "disabled_by_settings",
      recipientId: partner.id,
      email: partner.email,
    };
  }

  const claim = await claimDigestSlot({
    reportDate,
    recipientType: "partner",
    recipientId: partner.id,
    forceRetryFailed,
  });

  if (!claim.claimed) {
    return {
      status: "skipped",
      reason: claim.reason,
      recipientId: partner.id,
      email: partner.email,
    };
  }

  let emailed = false;
  try {
    const digest = await aggregatePartnerDigest(partner.id, reportDate);
    await sendPartnerDailyEodDigest({
      email: partner.email,
      partnerName: partner.srName,
      digest,
    });
    emailed = true;
    await markDigestSent(claim.row, partner.email);
    return {
      status: "sent",
      reason: claim.reason,
      recipientId: partner.id,
      email: partner.email,
    };
  } catch (err) {
    console.error(
      `[dailyEodDigest] Partner ${partner.id} send failed:`,
      err.message,
    );
    if (emailed) {
      try {
        await markDigestSent(claim.row, partner.email);
      } catch (markErr) {
        console.error(
          `[dailyEodDigest] CRITICAL: partner ${partner.id} digest emailed but claim not marked sent:`,
          markErr.message,
        );
      }
      return {
        status: "sent",
        reason: "sent_claim_mark_warning",
        recipientId: partner.id,
        email: partner.email,
      };
    }
    try {
      await markDigestFailed(claim.row, err.message);
    } catch (markErr) {
      console.error(
        `[dailyEodDigest] Failed to mark partner ${partner.id} claim failed:`,
        markErr.message,
      );
    }
    return {
      status: "failed",
      reason: err.message,
      recipientId: partner.id,
      email: partner.email,
    };
  }
}

/**
 * Main Lambda entry: send admin + all active partner digests for a business day.
 * Idempotent per recipient per reportDate.
 */
async function sendAllDailyEodDigests({
  reportDate: inputDate,
  forceRetryFailed = true,
} = {}) {
  const reportDate = inputDate || getBusinessDate();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(reportDate))) {
    throw new Error("Invalid reportDate. Expected YYYY-MM-DD.");
  }

  console.log(
    `[dailyEodDigest] START reportDate=${reportDate} forceRetryFailed=${forceRetryFailed}`,
  );

  const adminResult = await sendAdminDigestSafe({
    reportDate,
    forceRetryFailed,
  });

  const partners = await listActivePartners();
  const partnerResults = [];
  for (const partner of partners) {
    // Sequential sends: safer for rate limits and clearer failure isolation.
    // eslint-disable-next-line no-await-in-loop
    const result = await sendPartnerDigestSafe({
      partner,
      reportDate,
      forceRetryFailed,
    });
    partnerResults.push(result);
  }

  const summary = {
    reportDate,
    timezone: FLORIDA_TIMEZONE,
    admin: adminResult,
    partners: {
      total: partnerResults.length,
      sent: partnerResults.filter((r) => r.status === "sent").length,
      skipped: partnerResults.filter((r) => r.status === "skipped").length,
      failed: partnerResults.filter((r) => r.status === "failed").length,
      results: partnerResults,
    },
  };

  console.log(
    `[dailyEodDigest] DONE reportDate=${reportDate} admin=${adminResult.status} partnersSent=${summary.partners.sent} partnersSkipped=${summary.partners.skipped} partnersFailed=${summary.partners.failed}`,
  );

  return summary;
}

module.exports = {
  FLORIDA_TIMEZONE,
  getBusinessDate,
  formatDisplayDate,
  aggregateAdminDigest,
  aggregatePartnerDigest,
  claimDigestSlot,
  sendAllDailyEodDigests,
};
