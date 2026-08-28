/**
 * pulloutSyncStateService.js
 *
 * After a pullout finishes (Stripe success + DB has `adminReceivableStatus=true`,
 * `pulloutDate`, `pulloutIntentId`), reconcile the `pulloutIntentIdSynced`
 * state machine on the affected orders / partnerOrders rows.
 *
 * State machine (conservative):
 *   - "not-eligible" (default): no pullout yet, admin-skip rules apply, or any
 *                                pullout custom-field gate fails.
 *   - "eligible":               all gates pass but admin QBO invoice does not
 *                                yet carry the PulloutIntentId custom field.
 *   - "synced":                 admin QBO invoice now carries the field. This
 *                                column is flipped by the QBO write paths in
 *                                `qboInvoice.js`, `qboInvoiceUpdate.js`, and
 *                                `qboInvoiceCustomFieldPatch.js`. We never
 *                                downgrade `synced` here.
 *
 * Strategy:
 *   1. Load each row with associations so `partnerType` / `type` are present.
 *   2. Apply admin-skip rules (direct-partner customers; dropship direct-invoice).
 *   3. Run the static `isPulloutCustomFieldEligible(order)` check.
 *   4. If all gates pass and current state is not already `synced`, write
 *      `eligible` first (so we have a marker even if the patch call later
 *      fails or QBO is temporarily disconnected).
 *   5. When the row already has `quickBooksInvoiceId`, AWAIT
 *      `patchAdminInvoiceCustomFields(...)`. On success it transitions the
 *      row from `eligible` -> `synced` itself. The patch outcome is bubbled
 *      up to the caller so the reconcile result accurately reflects the
 *      final state (`synced` vs `eligible+failed`). This used to be
 *      fire-and-forget which let callers observe `action: 'patch_invoked'`
 *      while the row was still `eligible` — and then appear in the
 *      unsynced report despite a "successful" pullout. Bulk reconcile uses
 *      a small inline concurrency limiter so bulk pullouts do not go fully
 *      sequential while still bounding QBO load.
 *
 * Errors here never propagate to the caller — the pullout itself already
 * succeeded and we don't want post-processing to fail user-visible flows.
 */

const { order, partnerOrder } = require("../models");
const { getOrderWithAssociations } = require("./orderService");
const { isPulloutCustomFieldEligible } = require("./qboPulloutCustomField");
const {
  patchAdminInvoiceCustomFields,
} = require("./qboInvoiceCustomFieldPatch");

/** Mirrors `shouldSkipAdminQboSync` in qboInvoice.js / qboInvoiceCustomFieldPatch.js. */
// [QBO-POLICY-2026] Any customer order with salesRepId is excluded from admin QBO pullout sync.
function isAdminSkipForCustomer(orderRow) {
  return !!orderRow?.salesRepId;
}

function resolveModel(orderType) {
  return orderType === "local-partner" ? partnerOrder : order;
}

async function safeUpdateState({ MODEL, orderId, newState }) {
  try {
    await MODEL.update(
      { pulloutIntentIdSynced: newState },
      { where: { id: orderId } },
    );
  } catch (err) {
    console.warn(
      `[pullout-state] Failed to set pulloutIntentIdSynced=${newState} for ${MODEL?.name}#${orderId}:`,
      err?.message,
    );
  }
}

/**
 * Reconcile one order.
 *
 * Default behaviour (`awaitPatch=true`): when the row already has a QBO
 * invoice, AWAIT `patchAdminInvoiceCustomFields(...)` so the returned
 * `finalState` reflects the truth (`'synced'` or `'eligible'`). This is
 * the right default for pullout controllers — when the HTTP response
 * comes back, the unsynced report won't show the order anymore.
 *
 * Pass `awaitPatch: false` for callers that explicitly need
 * fire-and-forget semantics (e.g. high-throughput batch reconcile where
 * the caller doesn't care about the per-order outcome). Failures are
 * logged either way and NEVER thrown — the pullout itself already
 * succeeded.
 *
 * @param {Object} opts
 * @param {number|string} opts.orderId
 * @param {'customer'|'local-partner'} [opts.orderType='customer']
 * @param {boolean} [opts.awaitPatch=true]
 */
async function reconcilePulloutSyncStateForOrder({
  orderId,
  orderType = "customer",
  awaitPatch = true,
} = {}) {
  if (orderId == null) return { ok: false, reason: "no_order_id" };

  const MODEL = resolveModel(orderType);

  let orderRow;
  try {
    orderRow = await getOrderWithAssociations({ orderId, orderType });
  } catch (err) {
    console.warn(
      `[pullout-state] Failed to load order ${orderType}#${orderId}:`,
      err?.message,
    );
    return { ok: false, reason: "load_failed" };
  }
  if (!orderRow) return { ok: false, reason: "not_found" };

  // Never touch a row already marked `synced` — that means QBO confirmed.
  const current = orderRow.pulloutIntentIdSynced;
  if (current === "synced") {
    return {
      ok: true,
      action: "skipped",
      reason: "already_synced",
      finalState: "synced",
    };
  }

  // [QBO-POLICY-2026] Customer orders with salesRepId — admin QBO pullout sync disabled; stay not-eligible.
  if (orderType === "customer" && isAdminSkipForCustomer(orderRow)) {
    if (current !== "not-eligible") {
      await safeUpdateState({
        MODEL,
        orderId: orderRow.id,
        newState: "not-eligible",
      });
    }
    return {
      ok: true,
      action: "kept_not_eligible",
      reason: "admin_skip",
      finalState: "not-eligible",
    };
  }

  if (!isPulloutCustomFieldEligible(orderRow)) {
    if (current !== "not-eligible") {
      await safeUpdateState({
        MODEL,
        orderId: orderRow.id,
        newState: "not-eligible",
      });
    }
    return {
      ok: true,
      action: "kept_not_eligible",
      reason: "gates_not_met",
      finalState: "not-eligible",
    };
  }

  // Gates pass -> at minimum eligible.
  if (current !== "eligible") {
    await safeUpdateState({
      MODEL,
      orderId: orderRow.id,
      newState: "eligible",
    });
  }

  const qboInvoiceId =
    orderRow.quickBooksInvoiceId != null &&
    String(orderRow.quickBooksInvoiceId).trim() !== ""
      ? String(orderRow.quickBooksInvoiceId).trim()
      : null;

  if (!qboInvoiceId) {
    return {
      ok: true,
      action: "marked_eligible",
      reason: "no_admin_invoice",
      finalState: "eligible",
    };
  }

  // ── PATCH the QBO custom field. ─────────────────────────────────────
  // On success patchAdminInvoiceCustomFields flips the column to
  // `synced` itself; we just need to report the outcome back to the
  // caller. Failures here are caught — the pullout already succeeded so
  // we never let post-processing crash the user-facing flow.

  if (!awaitPatch) {
    patchAdminInvoiceCustomFields({
      orderId: orderRow.id,
      orderType,
    }).catch((err) => {
      console.warn(
        `[pullout-state] patchAdminInvoiceCustomFields failed for ${orderType}#${orderRow.id} (fire-and-forget): ${err?.message}`,
      );
    });
    return {
      ok: true,
      action: "patch_invoked",
      reason: "admin_invoice_present",
      finalState: "eligible",
    };
  }

  try {
    const patchResult = await patchAdminInvoiceCustomFields({
      orderId: orderRow.id,
      orderType,
    });

    // The patch service flips the DB column to `synced` itself when it
    // either patches QBO successfully or finds the field already set on
    // QBO. For "skipped" outcomes (no admin connection, gates not met,
    // etc.) the row stays at `eligible`.
    const flippedToSynced =
      patchResult?.action === "patched_custom_fields" ||
      (patchResult?.action === "skipped" &&
        patchResult?.reason === "pullout_already_set");

    const finalState = flippedToSynced ? "synced" : "eligible";

    console.log(
      `[pullout-state] ${orderType}#${orderRow.id} patch outcome: action=${
        patchResult?.action ?? "n/a"
      } reason=${patchResult?.reason ?? "n/a"} finalState=${finalState}`,
    );

    return {
      ok: true,
      action: "patch_completed",
      reason: "admin_invoice_present",
      finalState,
      patch: {
        action: patchResult?.action ?? null,
        reason: patchResult?.reason ?? null,
        invoiceId: patchResult?.invoiceId ?? null,
      },
    };
  } catch (err) {
    console.warn(
      `[pullout-state] patchAdminInvoiceCustomFields failed for ${orderType}#${orderRow.id}: ${err?.message}`,
    );
    return {
      ok: false,
      action: "patch_failed",
      reason: err?.message || "unknown_error",
      finalState: "eligible",
      error: {
        message: err?.message,
        statusCode: err?.statusCode ?? null,
        qboResponse: err?.qboResponse ?? null,
      },
    };
  }
}

/**
 * Tiny inline concurrency limiter — runs `fn(item)` for each item with at
 * most `concurrency` in flight at a time. Results are returned in input
 * order. We use an inline implementation because `p-limit@7` (installed
 * in this project) is ESM-only and cannot be required from CommonJS.
 */
async function runWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor;
      cursor += 1;
      try {
        results[idx] = await fn(items[idx], idx);
      } catch (err) {
        // fn already handles its own errors; defensive only.
        results[idx] = {
          ok: false,
          action: "worker_error",
          reason: err?.message,
        };
      }
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Reconcile many orders. Each is processed independently; failures are
 * logged. Uses bounded concurrency (default 4) so bulk pullouts don't go
 * fully sequential against QBO while still bounding QBO load.
 *
 * @param {Object} opts
 * @param {Array<number|string>} opts.orderIds
 * @param {'customer'|'local-partner'} [opts.orderType='customer']
 * @param {boolean} [opts.awaitPatch=true]
 * @param {number} [opts.concurrency=4]
 */
async function reconcilePulloutSyncStateForOrders({
  orderIds,
  orderType = "customer",
  awaitPatch = true,
  concurrency = 4,
} = {}) {
  if (!Array.isArray(orderIds) || orderIds.length === 0) return [];

  const results = await runWithConcurrency(
    orderIds,
    concurrency,
    async (id) => {
      const result = await reconcilePulloutSyncStateForOrder({
        orderId: id,
        orderType,
        awaitPatch,
      });
      return { orderId: id, ...result };
    },
  );

  // Compact summary log — useful when an admin pulls a batch and wants to
  // know how many rows actually reached `synced` vs `eligible`.
  const summary = results.reduce(
    (acc, r) => {
      acc[r.finalState || "unknown"] =
        (acc[r.finalState || "unknown"] || 0) + 1;
      if (r.action === "patch_failed") acc.failures += 1;
      return acc;
    },
    { failures: 0 },
  );
  console.log(
    `[pullout-state] bulk reconcile (${orderType}) ${orderIds.length} orders -> ${JSON.stringify(summary)}`,
  );

  return results;
}

module.exports = {
  reconcilePulloutSyncStateForOrder,
  reconcilePulloutSyncStateForOrders,
};
