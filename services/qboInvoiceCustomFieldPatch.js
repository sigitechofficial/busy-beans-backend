const axios = require("axios");
const { getOrderWithAssociations } = require("./orderService");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { account, qboCustomerMap, order, partnerOrder } = require("../models");
const { getPulloutCustomFieldEntry } = require("./qboPulloutCustomField");
const { handleQboError } = require("./qboErrorHandler");

const Order = order;
const PartnerOrder = partnerOrder;

const BASE =
  (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const QBO = (realmId) => `${BASE}/v3/company/${realmId}`;
const MINOR_READ = 70;
const MINOR_CUSTOM_FIELDS = 75;

/** Same rules as `handleAdminQboSync` — do not touch admin QBO for these customer orders. */
function shouldSkipAdminQboSync({ orderType, order }) {
  if (orderType !== "customer" || !order?.salesRepId) return false;
  if (order?.partnerType === "direct-partner") return true;
  return (
    order?.partnerType === "dropship-partner" &&
    order?.type === "direct-invoice"
  );
}

async function deleteQboCustomerMappingForUserInRealm(where) {
  if (!where || !where.realmId) return;
  try {
    const deleted = await qboCustomerMap.destroy({ where });
    if (deleted) {
      console.log(
        `[QBO] Removed not-connected customer mapping (re-sync customer):`,
        where,
      );
    }
  } catch (e) {
    console.warn(
      "[QBO] Failed to delete qboCustomerMap for re-connect:",
      e?.message,
    );
  }
}

function normalizeQboCustomFieldArray(cf) {
  if (!cf) return [];
  return Array.isArray(cf) ? cf.map((r) => ({ ...r })) : [{ ...cf }];
}

function mergePulloutIntoCustomFields(existing, pulloutEntry) {
  const defId = String(pulloutEntry.DefinitionId);
  const arr = normalizeQboCustomFieldArray(existing);
  const idx = arr.findIndex((r) => String(r.DefinitionId) === defId);
  if (idx >= 0) {
    arr[idx] = { ...arr[idx], StringValue: pulloutEntry.StringValue };
  } else {
    arr.push({
      DefinitionId: pulloutEntry.DefinitionId,
      StringValue: pulloutEntry.StringValue,
    });
  }
  return arr;
}

/** Payload keys this function is allowed to POST. The whole point of this
 *  service is to be CustomField-only, so it is safe to call on paid /
 *  closed invoices. The guard below enforces that contract — if a future
 *  edit ever adds `Line`, `TotalAmt`, `TxnDate`, etc., we fail loud in
 *  dev before mutating financial data on QBO. */
const ALLOWED_PATCH_KEYS = new Set([
  "Id",
  "SyncToken",
  "sparse",
  "CustomField",
]);

/**
 * Returns true when a QBO response is the specific "legacy 3-slot custom
 * field length" validation rejection, e.g.:
 *
 *   "You cannot enter more than 31 characters in the sales_custom_1_val
 *    field. You tried entering Joe Argyle..., which is 48 characters."
 *
 * That validation fires on QBO Plus realms (where Sales Rep / etc. live
 * in the legacy 3-slot custom field system, hard-capped at 31 chars per
 * value) but NOT on QBO Advanced (which uses Enhanced custom fields with
 * ~250 char limits). It always rejects with `code: "6000"` and a Message
 * that mentions "31 characters" and/or a field name like
 * `sales_custom_<N>_val`.
 */
function isLegacyCustomFieldLengthError(postRes) {
  if (!postRes || postRes.status !== 400) return false;
  const errs = postRes.data?.Fault?.Error;
  if (!Array.isArray(errs) || errs.length === 0) return false;
  return errs.some((e) => {
    if (String(e?.code) !== "6000") return false;
    const blob = `${e?.Message || ""} ${e?.Detail || ""}`.toLowerCase();
    return (
      blob.includes("31 characters") || /sales_custom_\d+_val/.test(blob)
    );
  });
}

/**
 * Sparse-update **admin** QBO invoice custom fields only (no line items, dates, etc.).
 * Currently applies **Pullout** when `getPulloutCustomFieldEntry` passes.
 *
 * - Gates not met → `{ ok: true, action: 'skipped', reason: 'pullout_gates_not_met' }`
 * - Admin sync skipped (direct-partner / dropship rules) → skipped with reason
 * - Gates met, no `quickBooksInvoiceId` → `syncInvoiceOnQuikBooks` (create path includes Pullout)
 * - Gates met, invoice exists → GET merge `CustomField` for Pullout definition, POST sparse
 * - Paid / closed invoice (Balance 0) → still patched. CustomField-only writes
 *   do not affect financials, so QBO accepts them on paid invoices. The
 *   payload-shape guard below enforces this contract.
 *
 * QBO Plus (legacy 3-slot custom fields) compatibility:
 * The first POST sends the full merged CustomField array. If QBO rejects
 * it with the specific "31 characters in sales_custom_<N>_val" validation
 * (see `isLegacyCustomFieldLengthError`), the function retries with a
 * Pullout-only payload. QBO's sparse merge-by-DefinitionId semantics
 * preserve the un-sent custom fields, so Sales Rep etc. stay intact on
 * the invoice. The result includes `usedPulloutOnlyFallback: true` when
 * this path took effect — handy for monitoring how many client realms
 * are on the legacy system.
 *
 * @param {Object} opts
 * @param {number} opts.orderId
 * @param {'customer'|'local-partner'} [opts.orderType='customer']
 */
async function patchAdminInvoiceCustomFields({
  orderId,
  orderType = "customer",
} = {}) {
  if (orderId == null || Number(orderId) <= 0) {
    throw new Error("patchAdminInvoiceCustomFields: orderId is required");
  }

  const numericId = Number(orderId);
  const DBMODEL = orderType === "local-partner" ? PartnerOrder : Order;
  const orderRow = await getOrderWithAssociations({
    orderId: numericId,
    orderType,
  });
  if (!orderRow) throw new Error(`Order not found id=${numericId}`);

  const pulloutCf = getPulloutCustomFieldEntry(orderRow);
  if (!pulloutCf) {
    return { ok: true, action: "skipped", reason: "pullout_gates_not_met" };
  }

  if (shouldSkipAdminQboSync({ orderType, order: orderRow })) {
    const reason =
      orderRow?.partnerType === "direct-partner"
        ? "skipped_admin_sync_direct_partner_order"
        : "skipped_admin_sync_dropship_direct_invoice_order";
    return { ok: true, action: "skipped", reason };
  }

  const ADMIN = await account.findOne({});
  if (!ADMIN?.currentRealmId) {
    return { ok: false, action: "skipped", reason: "admin_qbo_not_connected" };
  }

  const adminQboCondition = {
    realmId: ADMIN.currentRealmId,
    accountId: ADMIN.id,
  };

  const customerOrPartnerCondition = { ...adminQboCondition };
  if (orderType === "customer") {
    customerOrPartnerCondition.userId = orderRow.userId;
  } else if (orderType === "local-partner") {
    customerOrPartnerCondition.salesRepId = orderRow.salesRepId;
  }

  const qboCustomerOnAdmin = await qboCustomerMap.findOne({
    where: customerOrPartnerCondition,
  });
  if (!qboCustomerOnAdmin?.qboCustomerId) {
    await deleteQboCustomerMappingForUserInRealm({
      realmId: ADMIN.currentRealmId,
      accountId: ADMIN.id,
      userId: orderRow?.userId,
    });
    return {
      ok: false,
      action: "skipped",
      reason: "admin_qbo_customer_not_connected",
    };
  }

  const qboInvoiceIdRaw = orderRow.quickBooksInvoiceId;
  const hasInvoice =
    qboInvoiceIdRaw != null && String(qboInvoiceIdRaw).trim() !== "";

  if (!hasInvoice) {
    const { syncInvoiceOnQuikBooks } = require("./syncInvoiceOnQBO");
    const syncResult = await syncInvoiceOnQuikBooks({
      orderId: numericId,
      orderType,
      updateRequest: false,
    });
    return {
      ok: true,
      action: "synced_invoice",
      reason: "no_admin_invoice_id",
      syncResult,
    };
  }

  const qboInvoiceId = String(qboInvoiceIdRaw).trim();

  const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
    condition: adminQboCondition,
  });
  if (!accessToken || !realmId) {
    return {
      ok: false,
      action: "skipped",
      reason: "admin_qbo_token_or_realm_missing",
    };
  }

  const getUrl = `${QBO(realmId)}/invoice/${encodeURIComponent(qboInvoiceId)}?minorversion=${MINOR_READ}`;
  const invRes = await axios.get(getUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    validateStatus: () => true,
  });

  if (invRes.status !== 200 || !invRes.data?.Invoice) {
    handleQboError({
      err: { response: invRes },
      context: "[QBO][patchAdminInvoiceCustomFields] GET invoice failed:",
    });
    const msg =
      invRes.data?.Fault?.Error?.[0]?.Message ||
      `Could not load QBO invoice ${qboInvoiceId}`;
    const err = new Error(msg);
    err.statusCode = invRes.status === 404 ? 404 : 400;
    err.isPublic = true;
    throw err;
  }

  const currentInvoice = invRes.data.Invoice;
  // NOTE: paid / closed invoices (Balance 0) are intentionally NOT skipped
  // here. This function is CustomField-only by contract (see
  // ALLOWED_PATCH_KEYS guard below), and QBO permits custom field updates
  // on paid invoices since they do not affect financials.

  const existingRows = normalizeQboCustomFieldArray(currentInvoice.CustomField);
  const existingPullout = existingRows.find(
    (r) => String(r.DefinitionId) === String(pulloutCf.DefinitionId),
  );
  if (
    existingPullout &&
    String(existingPullout.StringValue || "").trim() === pulloutCf.StringValue
  ) {
    // Invoice already carries the same PulloutIntentId — reconcile the row's
    // state machine even though we don't need to call QBO again.
    if (orderRow.pulloutIntentIdSynced !== "synced") {
      try {
        await DBMODEL.update(
          { pulloutIntentIdSynced: "synced" },
          { where: { id: orderRow.id } },
        );
      } catch (flipErr) {
        console.warn(
          `[QBO] Could not flip pulloutIntentIdSynced=synced for order ${orderRow.id}:`,
          flipErr?.message,
        );
      }
    }
    return { ok: true, action: "skipped", reason: "pullout_already_set" };
  }

  const mergedCustomFields = mergePulloutIntoCustomFields(
    currentInvoice.CustomField,
    pulloutCf,
  );

  // Inline helper — builds the QBO sparse-update payload from a CustomField
  // array, runs the payload-shape guard, and POSTs. Defined here so the
  // fallback path below can reuse the exact same code path (one place to
  // change auth/headers/url forever).
  const postSparseCustomFieldPatch = async (customFields, attemptLabel) => {
    const body = {
      Id: String(currentInvoice.Id),
      SyncToken: String(currentInvoice.SyncToken),
      sparse: true,
      CustomField: customFields,
    };

    // Belt-and-suspenders: this function is CustomField-only by contract so
    // it is safe to call on paid invoices. If anyone later adds Line /
    // TotalAmt / TxnDate / Customer here, fail loud before the request
    // reaches QBO instead of silently mutating financial data on paid
    // invoices.
    for (const key of Object.keys(body)) {
      if (!ALLOWED_PATCH_KEYS.has(key)) {
        throw new Error(
          `[patchAdminInvoiceCustomFields] disallowed payload key "${key}" — this path must remain CustomField-only.`,
        );
      }
    }

    const url = `${QBO(realmId)}/invoice?minorversion=${MINOR_CUSTOM_FIELDS}&include=enhancedAllCustomFields`;
    console.log(
      `[QBO][patchAdminInvoiceCustomFields] POST attempt=${attemptLabel} invoice=${currentInvoice.Id} customFieldCount=${customFields.length}`,
    );
    return axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });
  };

  // ── First attempt: full merged CustomField array. ──────────────────
  // On QBO Advanced / Enhanced custom-field realms (e.g. our dev) this is
  // the normal happy path and succeeds in one round-trip.
  let postRes = await postSparseCustomFieldPatch(mergedCustomFields, "merged");
  let attemptedFallback = false;

  // ── Fallback for QBO Plus / legacy 3-slot realms: ──────────────────
  // QBO Plus stores Sales Rep / Customer PO etc. in the legacy
  // `sales_custom_<N>_val` slots, which enforce a hard 31-char limit at
  // sparse-update time even though the same value was happily accepted
  // when the invoice was originally created. Re-sending those existing
  // values verbatim trips a 6000 ValidationFault.
  //
  // The workaround relies on QBO's documented sparse semantics with
  // `include=enhancedAllCustomFields` (minorversion 75+): when only some
  // CustomField entries are sent, QBO merges by DefinitionId and leaves
  // un-sent rows untouched. So a Pullout-only payload patches *only* the
  // Pullout field without re-validating Sales Rep at all.
  //
  // We trigger this fallback ONLY on the exact "legacy 31-char" error
  // signature so realms that don't have this problem don't change
  // behavior at all.
  if (isLegacyCustomFieldLengthError(postRes)) {
    attemptedFallback = true;
    console.warn(
      `[QBO][patchAdminInvoiceCustomFields] Legacy 3-slot custom-field validation rejected the full payload for invoice ${currentInvoice.Id} (likely QBO Plus realm). Retrying with Pullout-only payload — other custom fields are preserved by QBO sparse merge-by-DefinitionId semantics. Original Fault: ${JSON.stringify(postRes.data?.Fault || null)}`,
    );

    const pulloutOnlyCustomFields = [
      {
        DefinitionId: pulloutCf.DefinitionId,
        StringValue: pulloutCf.StringValue,
      },
    ];

    postRes = await postSparseCustomFieldPatch(
      pulloutOnlyCustomFields,
      "pullout-only-fallback",
    );
  }

  if (postRes.status < 200 || postRes.status >= 300 || !postRes.data?.Invoice) {
    handleQboError({
      err: { response: postRes },
      context: `[QBO][patchAdminInvoiceCustomFields] POST invoice failed${attemptedFallback ? " (after pullout-only fallback)" : ""}:`,
    });
    const msg =
      postRes.data?.Fault?.Error?.[0]?.Message ||
      `QBO custom field update failed (${postRes.status})`;
    const err = new Error(msg);
    err.statusCode = 400;
    err.isPublic = true;
    err.qboResponse = postRes.data;
    throw err;
  }

  if (attemptedFallback) {
    console.log(
      `[QBO][patchAdminInvoiceCustomFields] Pullout-only fallback succeeded for invoice ${currentInvoice.Id}.`,
    );
  }

  await DBMODEL.update(
    {
      qboLastSync: new Date(),
      // Sparse patch is admin-only by design and just succeeded for the
      // Pullout custom field, so the admin invoice now carries it.
      pulloutIntentIdSynced: "synced",
    },
    { where: { id: orderRow.id } },
  );

  return {
    ok: true,
    action: "patched_custom_fields",
    invoiceId: postRes.data.Invoice.Id,
    customField: pulloutCf,
    usedPulloutOnlyFallback: attemptedFallback,
  };
}

module.exports = {
  patchAdminInvoiceCustomFields,
};
