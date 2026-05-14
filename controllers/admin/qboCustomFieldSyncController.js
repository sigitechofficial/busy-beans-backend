/**
 * controllers/admin/qboCustomFieldSyncController.js
 *
 * Admin-triggered, UI-driven bulk operations that push QBO invoice
 * custom-field updates for orders selected from the
 * `pullout-intent-unsynced-orders` report.
 *
 * Backed by `services/qboInvoiceCustomFieldPatch.js::patchAdminInvoiceCustomFields`,
 * which is responsible for:
 *   - running every gate (`getPulloutCustomFieldEntry`),
 *   - running the admin-skip rule (direct-partner / dropship direct-invoice),
 *   - GET-ing the live QBO invoice + SyncToken,
 *   - skipping paid invoices,
 *   - sparse POST-ing the merged `CustomField` array,
 *   - flipping `pulloutIntentIdSynced` to `'synced'` on success.
 *
 * Per-order failures never break the batch: every order is processed
 * independently inside its own try/catch and we always respond 200 with a
 * detailed summary, so the frontend can show successes / skips / failures
 * side by side.
 */

const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const { order } = require("../../models");
const {
  patchAdminInvoiceCustomFields,
} = require("../../services/qboInvoiceCustomFieldPatch");

const MAX_BATCH_SIZE = 100;
const ALLOWED_ORDER_TYPES = new Set(["customer", "local-partner"]);

/**
 * GET /api/v1/admin/admin-reports/pullout-intent-unsynced-orders
 *
 * Lists customer orders whose Pullout custom field has not yet been pushed to
 * the admin's QBO invoice. Matches every gate of `getPulloutCustomFieldEntry`
 * plus the business filters we agreed on:
 *
 *   - salesRep.partnerType === 'dropship-partner'
 *   - order.type === 'regular-order'
 *   - order.pulloutIntentIdSynced != 'synced'   (see `?syncStatus=` below)
 *   - order.paymentMethod === 'Bank Check'  (case-insensitive — MySQL default
 *       collation is `_ci`, so the SQL filter below also matches "bank check"
 *       etc. The eligibility helper in qboPulloutCustomField.js is explicit.)
 *   - order.userId, order.salesRepId, order.pulloutIntentId, order.quickBooksInvoiceId all present
 *
 * Optional filters:
 *   - startDate, endDate (on `orders.on`)
 *   - salesRepId
 *   - syncStatus (default `unsynced`):
 *       - `unsynced` -> pulloutIntentIdSynced <> 'synced'
 *       - `synced`   -> pulloutIntentIdSynced = 'synced'
 *       - `all`      -> no filter on sync state
 *     Lets the same endpoint power both the "needs sync" and "already synced"
 *     tabs in the admin UI.
 *
 * Pagination: page (default 1), limit (default 20).
 */
/** Allowed values for the `?syncStatus=` query parameter on the report. */
const SYNC_STATUS_FILTERS = new Set(["unsynced", "synced", "all"]);

exports.pulloutIntentUnsyncedOrdersReport = catchAsync(
  async (req, res, next) => {
    const { startDate, endDate, salesRepId } = req.query;
    const page = Math.max(parseInt(req.query.page || 1, 10), 1);
    const limit = Math.max(parseInt(req.query.limit || 20, 10), 1);
    const offset = (page - 1) * limit;

    // Sync-status filter:
    //   "unsynced" (default) -> pulloutIntentIdSynced <> 'synced'
    //   "synced"             -> pulloutIntentIdSynced = 'synced'
    //   "all"                -> no filter on sync state
    // The endpoint name says "unsynced" for backwards-compat; the filter
    // lets the same UI also show synced rows (audit view) without a
    // separate route.
    const rawSyncStatus = (req.query.syncStatus || "unsynced")
      .toString()
      .trim()
      .toLowerCase();
    if (!SYNC_STATUS_FILTERS.has(rawSyncStatus)) {
      return next(
        new AppError(
          `Invalid syncStatus. Allowed: ${[...SYNC_STATUS_FILTERS].join(", ")}.`,
          400,
        ),
      );
    }
    const syncStatus = rawSyncStatus;

    const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
    const replacements = { limit, offset };

    let dateFilter = "";
    if (startDate || endDate) {
      if (!startDate || !endDate) {
        return next(
          new AppError(
            "Both startDate and endDate are required when filtering by date",
            400,
          ),
        );
      }
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return next(
          new AppError(
            "Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS",
            400,
          ),
        );
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return next(new AppError("Invalid date values", 400));
      }
      dateFilter = "AND orders.on >= :startDate AND orders.on <= :endDate";
      replacements.startDate = startDate;
      replacements.endDate = endDate;
    }

    let salesRepFilter = "";
    if (salesRepId !== undefined && salesRepId !== null && salesRepId !== "") {
      const parsedSalesRepId = parseInt(salesRepId, 10);
      if (isNaN(parsedSalesRepId) || parsedSalesRepId <= 0) {
        return next(new AppError("Invalid salesRepId", 400));
      }
      salesRepFilter = "AND orders.salesRepId = :salesRepId";
      replacements.salesRepId = parsedSalesRepId;
    }

    let syncStatusFilter = "";
    if (syncStatus === "unsynced") {
      syncStatusFilter = "AND orders.pulloutIntentIdSynced <> 'synced'";
    } else if (syncStatus === "synced") {
      syncStatusFilter = "AND orders.pulloutIntentIdSynced = 'synced'";
    }
    // "all" -> no clause

    // Every gate that decides whether the Pullout custom field can be pushed
    // to admin QBO, expressed in SQL. Keep in sync with
    // `services/qboPulloutCustomField.js`.
    const baseWhere = `
      orders.deleted = 0
      ${syncStatusFilter}
      AND orders.userId IS NOT NULL
      AND orders.quickBooksInvoiceId IS NOT NULL
      AND orders.salesRepId IS NOT NULL
      AND orders.paymentMethod = 'Bank Check'
      AND orders.pulloutIntentId IS NOT NULL
      AND TRIM(orders.pulloutIntentId) <> ''
      AND orders.type = 'regular-order'
      AND (
        SELECT salesReps.partnerType
        FROM salesReps
        WHERE salesReps.id = orders.salesRepId
        LIMIT 1
      ) = 'dropship-partner'
      ${dateFilter}
      ${salesRepFilter}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM orders
      WHERE ${baseWhere}
    `;

    const dataQuery = `
      SELECT
        orders.id,
        orders.invoiceNumber,
        orders.totalBill,
        orders.on,
        orders.salesRepId,
        orders.userId,
        orders.paymentMethod,
        orders.paymentStatus,
        orders.type,
        orders.adminReceivableStatus,
        orders.adminReceivableAmount,
        orders.localPatnerCommission,
        orders.pulloutIntentId,
        orders.pulloutIntentIdSynced,
        orders.pulloutDate,
        orders.quickBooksInvoiceId,
        orders.adminRealmId,
        (
          SELECT users.companyName
          FROM users
          WHERE users.id = orders.userId
          LIMIT 1
        ) AS companyName,
        (
          SELECT salesReps.srName
          FROM salesReps
          WHERE salesReps.id = orders.salesRepId
          LIMIT 1
        ) AS salesRepName,
        (
          SELECT salesReps.partnerType
          FROM salesReps
          WHERE salesReps.id = orders.salesRepId
          LIMIT 1
        ) AS partnerType,
        CASE
          WHEN orders.quickBooksInvoiceId IS NULL
            OR TRIM(orders.quickBooksInvoiceId) = ''
          THEN 'needs_admin_invoice'
          ELSE 'needs_custom_field_patch'
        END AS pendingReason
      FROM orders
      WHERE ${baseWhere}
      ORDER BY orders.on DESC, orders.id DESC
      LIMIT :limit OFFSET :offset
    `;

    const countRows = await order.sequelize.query(countQuery, {
      replacements,
      type: order.sequelize.QueryTypes.SELECT,
    });
    const total = parseInt(countRows?.[0]?.total || 0, 10);

    const rows = await order.sequelize.query(dataQuery, {
      replacements,
      type: order.sequelize.QueryTypes.SELECT,
    });

    res.status(200).json({
      status: "success",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      data: rows,
    });
  },
);

/**
 * Classify a per-order result into one of three buckets so the frontend
 * can render success / warning / error states without parsing strings.
 */
function classifyResult(result) {
  if (!result || result.ok === false) return "failed";
  if (result.action === "patched_custom_fields") return "synced";
  if (result.action === "synced_invoice") return "synced";
  return "skipped";
}

/**
 * POST /api/v1/admin/qbo/pullout-custom-field/sync
 *
 * Body:
 *   {
 *     orderIds:  [number, ...],            // required, max 100 ids
 *     orderType: "customer" | "local-partner"   // optional, default "customer"
 *   }
 */
exports.bulkSyncPulloutCustomField = catchAsync(async (req, res, next) => {
  const { orderIds, orderType: rawOrderType } = req.body || {};

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return next(new AppError("orderIds must be a non-empty array", 400));
  }

  if (orderIds.length > MAX_BATCH_SIZE) {
    return next(
      new AppError(
        `Too many orderIds in one request. Max allowed is ${MAX_BATCH_SIZE}.`,
        400,
      ),
    );
  }

  const orderType = rawOrderType || "customer";
  if (!ALLOWED_ORDER_TYPES.has(orderType)) {
    return next(
      new AppError(
        `Invalid orderType. Allowed values: ${[...ALLOWED_ORDER_TYPES].join(", ")}.`,
        400,
      ),
    );
  }

  // Validate + dedupe ids while preserving the order the UI sent.
  const seen = new Set();
  const cleanIds = [];
  for (const raw of orderIds) {
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
      return next(
        new AppError(
          `Invalid orderId "${raw}". orderIds must contain positive integers.`,
          400,
        ),
      );
    }
    if (seen.has(id)) continue;
    seen.add(id);
    cleanIds.push(id);
  }

  const results = [];
  const summary = { total: cleanIds.length, synced: 0, skipped: 0, failed: 0 };

  // Sequential to be safe with QBO rate limits and DB load. Each call is
  // ~2 QBO HTTP round trips + DB writes; for a 50-id batch this typically
  // completes in under a minute. If needed we can add a small concurrency
  // pool later.
  for (const orderId of cleanIds) {
    try {
      console.log(
        `[QBO-PULLOUT-CF][bulk-sync] -> patching order#${orderId} (${orderType})`,
      );
      const result = await patchAdminInvoiceCustomFields({
        orderId,
        orderType,
      });

      const outcome = classifyResult(result);
      summary[outcome] += 1;

      results.push({
        orderId,
        ok: result?.ok !== false,
        outcome,
        action: result?.action ?? null,
        reason: result?.reason ?? null,
        invoiceId: result?.invoiceId ?? null,
        customField: result?.customField ?? null,
        // syncResult is only present when patchAdminInvoiceCustomFields
        // falls back to creating an admin invoice from scratch.
        syncResult: result?.syncResult ?? null,
      });

      console.log(
        `[QBO-PULLOUT-CF][bulk-sync] <- order#${orderId} outcome=${outcome} action=${result?.action} reason=${result?.reason ?? "-"}`,
      );
    } catch (err) {
      summary.failed += 1;
      const statusCode = err?.statusCode || err?.response?.status || 500;
      const qboResponse =
        err?.qboResponse ||
        err?.response?.data ||
        null;

      results.push({
        orderId,
        ok: false,
        outcome: "failed",
        action: null,
        reason: err?.message || "Unknown error",
        statusCode,
        qboResponse,
        invoiceId: null,
        customField: null,
      });

      console.warn(
        `[QBO-PULLOUT-CF][bulk-sync] !! order#${orderId} failed:`,
        err?.message,
      );
    }
  }

  return res.status(200).json({
    status: "success",
    summary,
    results,
  });
});
