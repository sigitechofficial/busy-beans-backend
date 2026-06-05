// services/paymentSyncService.js

const { createQboPayment } = require("./qboInvoice");

const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { handleQboError } = require("./qboErrorHandler");

const {
  getOrderWithAssociations,
  getOrdersWithAssociations,
} = require("./orderService");

const {
  order,
  partnerOrder,
  salesRep,
  account,
  qboCustomerMap,
} = require("../models");

/**
 * When payment sync uses the invoice's CustomerRef (not the map), align the map
 * so future invoice/customer flows do not keep using a stale qboCustomerId.
 */
async function healQboCustomerMapIfNeeded({ mapRow, invoiceCustomerId }) {
  const mapped = String(mapRow?.qboCustomerId || "").trim();
  const fromInvoice = String(invoiceCustomerId || "").trim();
  if (!mapRow?.id || !mapped || !fromInvoice || mapped === fromInvoice) {
    return;
  }
  console.warn(
    `[QBO] Heal qboCustomerMap id=${mapRow.id}: ${mapped} -> ${fromInvoice} (invoice CustomerRef)`,
  );
  await mapRow.update({ qboCustomerId: fromInvoice });
}

/* ============================================================
   ADMIN PAYMENT SYNC
============================================================ */

async function syncAdminPaymentToQBO({ ord, ADMIN, MODEL, orderType }) {
  console.log("🚀 [QBO] Admin payment sync:", ord.id);

  if (
    !ord?.adminRealmId ||
    ord?.quickBooksPaymentId ||
    !ord?.quickBooksInvoiceId ||
    ord?.paymentStatus !== "done"
  ) {
    return { skipped: true };
  }

  const adminCondition = {
    realmId: ord.adminRealmId,
    accountId: ADMIN.id,
  };

  const customerCondition =
    orderType === "customer"
      ? { ...adminCondition, userId: ord.userId }
      : { ...adminCondition, salesRepId: ord.salesRepId };

  const qboCustomer = await qboCustomerMap.findOne({
    where: customerCondition,
  });

  if (!qboCustomer?.qboCustomerId) {
    throw new Error("QBO customer not found for admin");
  }

  const { accessToken } = await refreshAccessTokenIfNeeded({
    condition: adminCondition,
  });

  if (!accessToken) {
    throw new Error("Admin QBO token missing");
  }

  // First attempt
  let result = await createQboPayment({
    accessToken,
    invoiceId: ord.quickBooksInvoiceId,
    order: ord,
    realmId: ord.adminRealmId,
    qboCustomerId: qboCustomer.qboCustomerId,
    subtractLocalPartnerCommission:
      orderType === "customer" && !!ord?.salesRepId,
  });

  // Retry with force=true (which enables allowRecovery inside
  // createPaymentForInvoice) ONLY when the first attempt was skipped because
  // the invoice is paid/closed but has no linked payment on QBO. The
  // targeted "existing-payment" pre-check runs again inside the retry, so
  // this can never produce a duplicate payment.
  if (result?.skipped && result?.reason === "paid_no_linked_payment") {
    console.warn(
      `⚠️ [QBO] Invoice ${ord.quickBooksInvoiceId} closed without linked payment. Retrying with allowRecovery...`,
    );

    result = await createQboPayment({
      accessToken,
      invoiceId: ord.quickBooksInvoiceId,
      order: ord,
      realmId: ord.adminRealmId,
      qboCustomerId: qboCustomer.qboCustomerId,
      subtractLocalPartnerCommission:
        orderType === "customer" && !!ord?.salesRepId,
      force: true,
    });
  }

  const paymentId = result?.paymentId || result?.id;

  if (!paymentId) {
    if (result?.skipped) {
      throw new Error(
        `Failed to create or recover admin payment for invoice ${ord.quickBooksInvoiceId}: ${result.reason || "skipped"} - ${result.note || ""}`,
      );
    }
    throw new Error(
      `Failed to create or recover admin payment for invoice ${ord.quickBooksInvoiceId}`,
    );
  }

  await healQboCustomerMapIfNeeded({
    mapRow: qboCustomer,
    invoiceCustomerId: result?.customerIdUsed,
  });

  await MODEL.update(
    {
      quickBooksPaymentId: paymentId,
      paymentSyncedToQBO: true,
      qboLastSync: new Date(),
    },
    { where: { id: ord.id } },
  );

  console.log(`✅ [QBO] Admin payment saved: ${paymentId}`);

  return { success: true, paymentId };
}

/* ============================================================
   PARTNER PAYMENT SYNC
============================================================ */

async function syncPartnerPaymentToQBO({ ord, MODEL }) {
  console.log("🚀 [QBO] Partner payment sync:", ord.id);

  if (
    !ord?.partnerRealmId ||
    ord?.quickBooksPaymentIdPartner ||
    !ord?.quickBooksInvoiceIdPartner ||
    ord?.paymentStatus !== "done"
  ) {
    return { skipped: true };
  }

  const partnerCondition = {
    realmId: ord.partnerRealmId,
    salesRepId: ord.salesRepId,
  };

  const customerCondition = {
    ...partnerCondition,
    userId: ord.userId,
  };

  const qboCustomer = await qboCustomerMap.findOne({
    where: customerCondition,
  });

  if (!qboCustomer?.qboCustomerId) {
    throw new Error("QBO customer not found for partner");
  }

  const { accessToken } = await refreshAccessTokenIfNeeded({
    condition: partnerCondition,
  });

  if (!accessToken) {
    throw new Error("Partner QBO token missing");
  }

  let result = await createQboPayment({
    accessToken,
    invoiceId: ord.quickBooksInvoiceIdPartner,
    order: ord,
    realmId: ord.partnerRealmId,
    qboCustomerId: qboCustomer.qboCustomerId,
    subtractLocalPartnerCommission: false,
  });

  // Retry with force=true (allowRecovery) only for the "paid invoice with
  // no linked payment" case. The targeted pre-check inside the retry will
  // prevent duplicate creation.
  if (result?.skipped && result?.reason === "paid_no_linked_payment") {
    console.warn(
      `⚠️ [QBO] Partner invoice ${ord.quickBooksInvoiceIdPartner} closed without linked payment. Retrying with allowRecovery...`,
    );

    result = await createQboPayment({
      accessToken,
      invoiceId: ord.quickBooksInvoiceIdPartner,
      order: ord,
      realmId: ord.partnerRealmId,
      qboCustomerId: qboCustomer.qboCustomerId,
      subtractLocalPartnerCommission: false,
      force: true,
    });
  }

  const paymentId = result?.paymentId || result?.id;

  if (!paymentId) {
    if (result?.skipped) {
      throw new Error(
        `Failed to create or recover partner payment for invoice ${ord.quickBooksInvoiceIdPartner}: ${result.reason || "skipped"} - ${result.note || ""}`,
      );
    }
    throw new Error(
      `Failed to create or recover partner payment for invoice ${ord.quickBooksInvoiceIdPartner}`,
    );
  }

  await healQboCustomerMapIfNeeded({
    mapRow: qboCustomer,
    invoiceCustomerId: result?.customerIdUsed,
  });

  await MODEL.update(
    {
      quickBooksPaymentIdPartner: paymentId,
      paymentSyncedToQBO: true,
      qboLastSync: new Date(),
    },
    { where: { id: ord.id } },
  );

  console.log(`✅ [QBO] Partner payment saved: ${paymentId}`);

  return { success: true, paymentId };
}

/* ============================================================
   ISOLATED ADMIN + PARTNER RUNNERS (admin failure must not block partner)
============================================================ */

function shouldAttemptAdminPaymentSync(ord, orderType) {
  return (
    ord?.paymentStatus === "done" &&
    !!ord?.adminRealmId &&
    !ord?.quickBooksPaymentId &&
    !!ord?.quickBooksInvoiceId
  );
}

function shouldAttemptPartnerPaymentSync(ord, orderType) {
  return (
    orderType === "customer" &&
    ord?.paymentStatus === "done" &&
    !!ord?.partnerRealmId &&
    !ord?.quickBooksPaymentIdPartner &&
    !!ord?.quickBooksInvoiceIdPartner
  );
}

async function runAdminPaymentSyncSafe({ ord, ADMIN, MODEL, orderType }) {
  if (!shouldAttemptAdminPaymentSync(ord, orderType)) {
    return { attempted: false };
  }
  try {
    const result = await syncAdminPaymentToQBO({
      ord,
      ADMIN,
      MODEL,
      orderType,
    });
    if (result?.skipped) {
      return { attempted: true, skipped: true };
    }
    return {
      attempted: true,
      success: true,
      paymentId: result.paymentId,
    };
  } catch (err) {
    console.error(
      `❌ [QBO] Admin payment sync failed for order ${ord.id} (partner sync will still run if eligible):`,
      err.message,
    );
    return { attempted: true, success: false, error: err.message };
  }
}

async function runPartnerPaymentSyncSafe({ ord, MODEL, orderType }) {
  if (!shouldAttemptPartnerPaymentSync(ord, orderType)) {
    return { attempted: false };
  }
  try {
    const result = await syncPartnerPaymentToQBO({ ord, MODEL });
    if (result?.skipped) {
      return { attempted: true, skipped: true };
    }
    return {
      attempted: true,
      success: true,
      paymentId: result.paymentId,
    };
  } catch (err) {
    console.error(
      `❌ [QBO] Partner payment sync failed for order ${ord.id}:`,
      err.message,
    );
    return { attempted: true, success: false, error: err.message };
  }
}

/**
 * Classify per-order payment sync after isolated admin + partner attempts.
 */
function buildOrderPaymentSyncOutcome(ord, { neededAdmin, neededPartner, adminRun, partnerRun }) {
  const adminOk = !neededAdmin || adminRun?.success === true;
  const partnerOk = !neededPartner || partnerRun?.success === true;

  const adminFailed = neededAdmin && adminRun?.attempted && !adminOk;
  const partnerFailed = neededPartner && partnerRun?.attempted && !partnerOk;

  const details = {
    admin: neededAdmin
      ? {
          attempted: true,
          success: adminOk && !adminFailed,
          paymentId: adminRun?.paymentId || ord.quickBooksPaymentId || null,
          error: adminRun?.error || null,
        }
      : { attempted: false },
    partner: neededPartner
      ? {
          attempted: true,
          success: partnerOk && !partnerFailed,
          paymentId: partnerRun?.paymentId || ord.quickBooksPaymentIdPartner || null,
          error: partnerRun?.error || null,
        }
      : { attempted: false },
  };

  if (adminOk && partnerOk && (neededAdmin || neededPartner)) {
    const parts = [];
    if (neededAdmin && adminRun?.success) parts.push("admin");
    if (neededPartner && partnerRun?.success) parts.push("partner");
    return {
      status: "success",
      message:
        parts.length > 0
          ? `Payment synced (${parts.join(" and ")})`
          : "Payment synced successfully",
      ...details,
    };
  }

  if (
    (neededAdmin && adminRun?.success) ||
    (neededPartner && partnerRun?.success)
  ) {
    const okParts = [];
    const failParts = [];
    if (neededAdmin && adminRun?.success) okParts.push("admin");
    else if (neededAdmin) failParts.push("admin");
    if (neededPartner && partnerRun?.success) okParts.push("partner");
    else if (neededPartner) failParts.push("partner");
    return {
      status: "partial",
      message: `Partial sync: ${okParts.join(", ") || "none"} succeeded; ${failParts.join(", ") || "none"} failed`,
      ...details,
    };
  }

  if (adminFailed || partnerFailed) {
    const msgs = [];
    if (adminRun?.error) msgs.push(`Admin: ${adminRun.error}`);
    if (partnerRun?.error) msgs.push(`Partner: ${partnerRun.error}`);
    return {
      status: "failed",
      message: msgs.join(" | ") || "Payment sync failed",
      ...details,
    };
  }

  return {
    status: "warning",
    message: "No payment created or linked",
    ...details,
  };
}

/** @returns {'admin'|'partner'|'both'} */
function resolvePaymentSyncSideFromEntity(entity) {
  if (entity === "localPartner" || entity === "partnerEmployee") {
    return "partner";
  }
  if (entity === "admin" || entity === "adminEmployee") {
    return "admin";
  }
  return "both";
}

function partnerPaymentSyncSkipReason(ord, orderType) {
  if (orderType !== "customer") return "partner_sync_customer_orders_only";
  if (ord.paymentStatus !== "done") return "payment_not_done";
  if (
    !ord.quickBooksInvoiceIdPartner ||
    String(ord.quickBooksInvoiceIdPartner).trim() === ""
  ) {
    return "no_partner_invoice";
  }
  if (
    ord.quickBooksPaymentIdPartner &&
    String(ord.quickBooksPaymentIdPartner).trim() !== ""
  ) {
    return "partner_payment_already_synced";
  }
  if (!ord.partnerRealmId) return "no_partner_realm";
  return null;
}

function formatBulkPaymentSyncSummaryMessage({
  successCount,
  partialCount,
  failureCount,
  total,
}) {
  let msg = `Bulk payment sync completed: ${successCount} succeeded`;
  if (partialCount > 0) {
    msg += `, ${partialCount} partial`;
  }
  msg += `, ${failureCount} failed out of ${total} total orders`;
  return msg;
}

/**
 * Per-order outcome for a single QBO side (admin or partner), used for entity-scoped bulk sync.
 */
function buildOrderPaymentSyncOutcomeForSide(
  ord,
  syncSide,
  { needed, run, existingPaymentId, alreadySyncedMessage, orderType = "customer" },
) {
  const hasExisting =
    existingPaymentId != null && String(existingPaymentId).trim() !== "";

  if (!needed) {
    if (hasExisting) {
      return {
        status: "success",
        message: alreadySyncedMessage,
        paymentId: String(existingPaymentId).trim(),
      };
    }
    const skipReason =
      syncSide === "admin"
        ? adminPaymentSyncSkipReason(ord)
        : partnerPaymentSyncSkipReason(ord, orderType);
    const skipMessages = {
      payment_not_done: "Payment not marked as done",
      no_admin_invoice: "No admin QuickBooks invoice on order",
      admin_payment_already_synced: alreadySyncedMessage,
      no_admin_realm: "No admin QuickBooks realm on order",
      no_partner_invoice: "No partner QuickBooks invoice on order",
      partner_payment_already_synced: alreadySyncedMessage,
      no_partner_realm: "No partner QuickBooks realm on order",
      partner_sync_customer_orders_only:
        "Partner payment sync applies to customer orders only",
      not_eligible: "No payment sync needed for this order",
    };
    return {
      status: "warning",
      message: skipMessages[skipReason] || "No payment created or linked",
      paymentId: null,
    };
  }

  if (run?.success && run?.paymentId) {
    return {
      status: "success",
      message: "Payment synced successfully",
      paymentId: run.paymentId,
    };
  }

  if (run?.attempted && run?.error) {
    return {
      status: "failed",
      message: run.error,
      paymentId: null,
    };
  }

  return {
    status: "warning",
    message: "No payment created or linked",
    paymentId: null,
  };
}

function mapBulkResultRowForSide(orderId, outcome) {
  const row = {
    orderId,
    status: outcome.status,
    message: outcome.message,
  };
  if (outcome.paymentId) {
    row.paymentId = outcome.paymentId;
  }
  return row;
}

/* ============================================================
   SINGLE ORDER PAYMENT SYNC
============================================================ */

async function syncPaymentToQuickBooks({
  orderId,
  orderType = "customer",
  syncSide = "both",
}) {
  console.log("🚀 [QBO] Sync single payment:", orderId);

  try {
    const ADMIN = await account.findOne({});
    const MODEL = orderType === "customer" ? order : partnerOrder;

    const ord = await getOrderWithAssociations({ orderId, orderType });

    if (!ord) throw new Error(`Order ${orderId} not found`);

    const side =
      syncSide === "admin" || syncSide === "partner" ? syncSide : "both";

    const neededAdmin = shouldAttemptAdminPaymentSync(ord, orderType);
    const neededPartner = shouldAttemptPartnerPaymentSync(ord, orderType);

    let outcome;
    if (side === "admin") {
      const adminRun = await runAdminPaymentSyncSafe({
        ord,
        ADMIN,
        MODEL,
        orderType,
      });
      outcome = buildOrderPaymentSyncOutcomeForSide(ord, "admin", {
        needed: neededAdmin,
        run: adminRun,
        existingPaymentId: ord.quickBooksPaymentId,
        alreadySyncedMessage: "Admin payment already synced",
        orderType,
      });
    } else if (side === "partner") {
      const partnerRun = await runPartnerPaymentSyncSafe({
        ord,
        MODEL,
        orderType,
      });
      outcome = buildOrderPaymentSyncOutcomeForSide(ord, "partner", {
        needed: neededPartner,
        run: partnerRun,
        existingPaymentId: ord.quickBooksPaymentIdPartner,
        alreadySyncedMessage: "Partner payment already synced",
        orderType,
      });
    } else {
      const adminRun = await runAdminPaymentSyncSafe({
        ord,
        ADMIN,
        MODEL,
        orderType,
      });
      const partnerRun = await runPartnerPaymentSyncSafe({
        ord,
        MODEL,
        orderType,
      });
      outcome = buildOrderPaymentSyncOutcome(ord, {
        neededAdmin,
        neededPartner,
        adminRun,
        partnerRun,
      });
    }

    if (outcome.status === "failed") {
      const err = new Error(outcome.message);
      handleQboError({
        err,
        context: `[QBO][PaymentSync] Error syncing order ${orderId}`,
      });
      throw err;
    }

    if (outcome.status === "partial") {
      console.warn(
        `⚠️ [QBO] Partial payment sync for order ${orderId}: ${outcome.message}`,
      );
    } else {
      console.log(`✅ [QBO] Payment synced: ${orderId} (${outcome.status})`);
    }

    const response = {
      status: outcome.status,
      message: outcome.message,
      syncSide: side,
    };
    if (side === "both") {
      response.admin = outcome.admin;
      response.partner = outcome.partner;
    } else if (outcome.paymentId) {
      response.paymentId = outcome.paymentId;
    }
    return response;
  } catch (err) {
    handleQboError({
      err,
      context: `[QBO][PaymentSync] Error syncing order ${orderId}`,
    });
    throw err;
  }
}

/* ============================================================
   BULK PAYMENT SYNC
============================================================ */

async function syncMultiplePaymentsToQuickBooks({
  orderIds,
  orderType = "customer",
  syncSide = "both",
}) {
  const side =
    syncSide === "admin" || syncSide === "partner" ? syncSide : "both";
  console.log("🚀 [QBO] Bulk payment sync:", { orderIds, syncSide: side });

  if (!Array.isArray(orderIds) || !orderIds.length) {
    throw new Error("orderIds must be a non-empty array");
  }

  try {
    const ADMIN = await account.findOne({});
    const MODEL = orderType === "customer" ? order : partnerOrder;

    const orders = await getOrdersWithAssociations({ orderIds, orderType });

    if (!orders?.length) {
      throw new Error("No orders found");
    }

    const results = [];

    let successCount = 0;
    let partialCount = 0;
    let failureCount = 0;

    for (const ord of orders) {
      console.log(`🔄 [QBO] Processing order ${ord.id}`);

      if (ord.paymentStatus !== "done") {
        results.push({
          orderId: ord.id,
          status: "skipped",
          message: "Payment not marked as done",
        });
        continue;
      }

      let outcome;
      if (side === "admin") {
        const neededAdmin = shouldAttemptAdminPaymentSync(ord, orderType);
        const adminRun = await runAdminPaymentSyncSafe({
          ord,
          ADMIN,
          MODEL,
          orderType,
        });
        outcome = buildOrderPaymentSyncOutcomeForSide(ord, "admin", {
          needed: neededAdmin,
          run: adminRun,
          existingPaymentId: ord.quickBooksPaymentId,
          alreadySyncedMessage: "Admin payment already synced",
          orderType,
        });
      } else if (side === "partner") {
        const neededPartner = shouldAttemptPartnerPaymentSync(ord, orderType);
        const partnerRun = await runPartnerPaymentSyncSafe({
          ord,
          MODEL,
          orderType,
        });
        outcome = buildOrderPaymentSyncOutcomeForSide(ord, "partner", {
          needed: neededPartner,
          run: partnerRun,
          existingPaymentId: ord.quickBooksPaymentIdPartner,
          alreadySyncedMessage: "Partner payment already synced",
          orderType,
        });
      } else {
        const neededAdmin = shouldAttemptAdminPaymentSync(ord, orderType);
        const neededPartner = shouldAttemptPartnerPaymentSync(ord, orderType);
        const adminRun = await runAdminPaymentSyncSafe({
          ord,
          ADMIN,
          MODEL,
          orderType,
        });
        const partnerRun = await runPartnerPaymentSyncSafe({
          ord,
          MODEL,
          orderType,
        });
        outcome = buildOrderPaymentSyncOutcome(ord, {
          neededAdmin,
          neededPartner,
          adminRun,
          partnerRun,
        });
      }

      const row =
        side === "both"
          ? {
              orderId: ord.id,
              status: outcome.status,
              message: outcome.message,
              admin: outcome.admin,
              partner: outcome.partner,
            }
          : mapBulkResultRowForSide(ord.id, outcome);

      results.push(row);

      if (outcome.status === "success") {
        successCount++;
      } else if (outcome.status === "partial") {
        partialCount++;
      } else if (outcome.status === "failed") {
        failureCount++;
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    const skippedCount = results.filter((r) => r.status === "skipped").length;
    const summary = {
      total: orders.length,
      syncSide: side,
      successCount,
      partialCount,
      failureCount,
      skippedCount,
      results,
      message: formatBulkPaymentSyncSummaryMessage({
        successCount,
        partialCount,
        failureCount,
        total: orders.length,
      }),
    };

    console.log("📊 [QBO] Bulk summary:", summary);

    return summary;
  } catch (err) {
    handleQboError({
      err,
      context: "[QBO][BulkPaymentSync]",
    });

    throw err;
  }
}

function adminPaymentSyncSkipReason(ord) {
  if (ord.paymentStatus !== "done") return "payment_not_done";
  if (!ord.quickBooksInvoiceId || String(ord.quickBooksInvoiceId).trim() === "")
    return "no_admin_invoice";
  if (ord.quickBooksPaymentId && String(ord.quickBooksPaymentId).trim() !== "")
    return "admin_payment_already_synced";
  if (!ord.adminRealmId) return "no_admin_realm";
  return "not_eligible";
}

/**
 * Sync **admin** QBO payments only for many orders (no partner QBO).
 * Same rules as `syncAdminPaymentToQBO`: paid orders with admin invoice, no admin payment yet, adminRealmId set.
 *
 * @param {Object} opts
 * @param {number[]} opts.orderIds
 * @param {'customer'|'local-partner'} [opts.orderType='customer']
 */
async function syncAdminPaymentsForOrders({
  orderIds,
  orderType = "customer",
} = {}) {
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error("orderIds must be a non-empty array");
  }

  const numericIds = [
    ...new Set(
      orderIds.map((id) => Number(id)).filter((n) => !Number.isNaN(n) && n > 0),
    ),
  ];
  if (numericIds.length === 0) {
    throw new Error("orderIds must contain valid numeric ids");
  }

  const ADMIN = await account.findOne({});
  if (!ADMIN?.id) {
    throw new Error("Admin account not found");
  }

  const MODEL = orderType === "customer" ? order : partnerOrder;

  const orders = await getOrdersWithAssociations({
    orderIds: numericIds,
    orderType,
  });
  const foundIdSet = new Set(orders.map((o) => o.id));
  const ordersNotFound = numericIds.filter((id) => !foundIdSet.has(id));

  const synced = [];
  const failed = [];
  const skipped = [];

  for (const ord of orders) {
    try {
      const preReason = adminPaymentSyncSkipReason(ord);
      if (preReason !== "not_eligible") {
        skipped.push({ orderId: ord.id, reason: preReason });
      } else {
        const adminResult = await syncAdminPaymentToQBO({
          ord,
          ADMIN,
          MODEL,
          orderType,
        });

        if (adminResult?.skipped) {
          skipped.push({
            orderId: ord.id,
            reason: adminPaymentSyncSkipReason(ord),
          });
        } else if (adminResult?.success && adminResult?.paymentId) {
          synced.push({
            orderId: ord.id,
            paymentId: adminResult.paymentId,
          });
        } else {
          skipped.push({ orderId: ord.id, reason: "no_payment_created" });
        }
      }
    } catch (err) {
      failed.push({
        orderId: ord.id,
        message: err.message || "sync_failed",
      });
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  return {
    orderType,
    synced,
    failed,
    skipped,
    ordersNotFound,
    summary: {
      synced: synced.length,
      failed: failed.length,
      skipped: skipped.length,
      ordersNotFound: ordersNotFound.length,
      totalRequested: numericIds.length,
    },
  };
}

module.exports = {
  syncPaymentToQuickBooks,
  syncMultiplePaymentsToQuickBooks,
  syncAdminPaymentsForOrders,
  resolvePaymentSyncSideFromEntity,
};
