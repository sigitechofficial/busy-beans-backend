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

function normalizeRealmId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

/**
 * Read-only diagnostics: log when the order's stored admin realm differs from
 * the admin account's current connected realm (or when adminRealmId was never
 * saved but a QBO invoice id exists). Does NOT change which realm/tokens the
 * patch uses — still `accounts.currentRealmId` — so behavior is unchanged.
 */
function logPulloutPatchRealmDiagnostics({ orderRow, currentRealmId }) {
  const orderId = orderRow?.id ?? "?";
  const invoiceNumber = orderRow?.invoiceNumber ?? "?";
  const orderAdminRealmId = normalizeRealmId(orderRow?.adminRealmId);
  const activeRealmId = normalizeRealmId(currentRealmId);
  const qboInvoiceId =
    orderRow?.quickBooksInvoiceId != null &&
    String(orderRow.quickBooksInvoiceId).trim() !== ""
      ? String(orderRow.quickBooksInvoiceId).trim()
      : null;

  if (!activeRealmId) return;

  if (
    orderAdminRealmId &&
    orderAdminRealmId !== activeRealmId
  ) {
    console.warn(
      `[QBO][patchAdminInvoiceCustomFields][realm-mismatch] order#${orderId} invoice=${invoiceNumber} ` +
        `order.adminRealmId=${orderAdminRealmId} accounts.currentRealmId=${activeRealmId} ` +
        `quickBooksInvoiceId=${qboInvoiceId ?? "null"} — ` +
        `Pullout patch uses currentRealmId; invoice may have been synced on a different QBO company.`,
    );
    return;
  }

  if (qboInvoiceId && !orderAdminRealmId) {
    console.warn(
      `[QBO][patchAdminInvoiceCustomFields][realm-missing] order#${orderId} invoice=${invoiceNumber} ` +
        `adminRealmId=null quickBooksInvoiceId=${qboInvoiceId} accounts.currentRealmId=${activeRealmId} — ` +
        `cannot verify which QBO company owns this invoice id.`,
    );
  }
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
 * True when QBO refused to return an invoice by stored Id — stale id,
 * deleted invoice, wrong realm, or broken/inactive links on the invoice.
 * Used to gate the DocNumber relink repair (we only repair on these).
 */
function isStaleInvoiceGetError(getRes) {
  if (!getRes) return false;
  if (getRes.status === 404) return true;
  const errs = getRes.data?.Fault?.Error;
  if (!Array.isArray(errs) || errs.length === 0) return false;
  return errs.some((e) => {
    const code = String(e?.code || "");
    const blob = `${e?.Message || ""} ${e?.Detail || ""}`.toLowerCase();
    return (
      code === "610" ||
      blob.includes("object not found") ||
      blob.includes("made inactive")
    );
  });
}

function qboAuthHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

/** GET a single QBO invoice by Id. Never throws — returns { ok, invoice, response }. */
async function fetchQboInvoiceById({ accessToken, realmId, invoiceId }) {
  const id = String(invoiceId).trim();
  const url = `${QBO(realmId)}/invoice/${encodeURIComponent(id)}?minorversion=${MINOR_READ}`;
  const response = await axios.get(url, {
    headers: qboAuthHeaders(accessToken),
    validateStatus: () => true,
  });
  if (response.status === 200 && response.data?.Invoice) {
    return { ok: true, invoice: response.data.Invoice, response };
  }
  return { ok: false, invoice: null, response };
}

/**
 * Look up admin QBO invoice(s) by DocNumber (= our invoiceNumber).
 * Returns [] on query failure. Does NOT create invoices.
 */
async function findQboInvoiceIdsByDocNumber({
  accessToken,
  realmId,
  docNumber,
}) {
  const doc = String(docNumber || "").trim();
  if (!doc) return { ok: false, ids: [], error: "no_doc_number" };

  const safeDoc = doc.replace(/'/g, "''");
  const query = `select Id, DocNumber from Invoice where DocNumber = '${safeDoc}'`;
  const url = `${QBO(realmId)}/query?query=${encodeURIComponent(query)}&minorversion=${MINOR_READ}`;
  const response = await axios.get(url, {
    headers: qboAuthHeaders(accessToken),
    validateStatus: () => true,
  });

  if (response.status !== 200) {
    return {
      ok: false,
      ids: [],
      error: `query_http_${response.status}`,
      response,
    };
  }

  const raw = response.data?.QueryResponse?.Invoice;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const ids = list
    .map((row) => (row?.Id != null ? String(row.Id).trim() : ""))
    .filter(Boolean);

  return { ok: true, ids, response };
}

/**
 * When GET by stored quickBooksInvoiceId fails with a stale/not-found
 * signature, try to find the live invoice by DocNumber and relink the DB.
 *
 * Conservative rules:
 *   - Never creates a new QBO invoice from this path.
 *   - Only updates quickBooksInvoiceId when a different Id loads via GET.
 *   - If DocNumber lookup finds nothing → caller returns a structured failure.
 *   - If candidates exist but none load → structured failure (inactive links).
 */
async function tryRepairStaleAdminInvoiceId({
  accessToken,
  realmId,
  storedInvoiceId,
  docNumber,
  orderRow,
  DBMODEL,
}) {
  const staleId = String(storedInvoiceId).trim();
  const lookup = await findQboInvoiceIdsByDocNumber({
    accessToken,
    realmId,
    docNumber,
  });

  if (!lookup.ok) {
    console.warn(
      `[QBO][patchAdminInvoiceCustomFields] DocNumber lookup failed for order#${orderRow.id} doc=${docNumber}:`,
      lookup.error,
    );
    return {
      repaired: false,
      reason: "docnumber_lookup_failed",
      staleInvoiceId: staleId,
      docNumber,
    };
  }

  if (lookup.ids.length === 0) {
    console.warn(
      `[QBO][patchAdminInvoiceCustomFields] No QBO invoice with DocNumber=${docNumber} for order#${orderRow.id} (stale id=${staleId}).`,
    );
    return {
      repaired: false,
      reason: "admin_invoice_not_found_by_docnumber",
      staleInvoiceId: staleId,
      docNumber,
    };
  }

  // Prefer ids different from the stale pointer first, then retry the same id
  // (covers "query works but direct GET path differed" edge cases).
  const candidates = [
    ...lookup.ids.filter((id) => id !== staleId),
    ...lookup.ids.filter((id) => id === staleId),
  ];
  const uniqueCandidates = [...new Set(candidates)];

  if (lookup.ids.length > 1) {
    console.warn(
      `[QBO][patchAdminInvoiceCustomFields] Multiple QBO invoices share DocNumber=${docNumber} (ids=${lookup.ids.join(
        ", ",
      )}). Trying GET on each until one loads.`,
    );
  }

  for (const candidateId of uniqueCandidates) {
    const fetched = await fetchQboInvoiceById({
      accessToken,
      realmId,
      invoiceId: candidateId,
    });
    if (!fetched.ok) continue;

    const relinked = candidateId !== staleId;
    if (relinked) {
      try {
        await DBMODEL.update(
          {
            quickBooksInvoiceId: candidateId,
            adminRealmId: realmId,
          },
          { where: { id: orderRow.id } },
        );
        console.log(
          `[QBO][patchAdminInvoiceCustomFields] Relinked order#${orderRow.id} quickBooksInvoiceId ${staleId} -> ${candidateId} (DocNumber=${docNumber}).`,
        );
      } catch (dbErr) {
        console.warn(
          `[QBO][patchAdminInvoiceCustomFields] Found live invoice ${candidateId} but failed to update DB for order#${orderRow.id}:`,
          dbErr?.message,
        );
        return {
          repaired: false,
          reason: "relink_db_update_failed",
          staleInvoiceId: staleId,
          docNumber,
          candidateInvoiceId: candidateId,
        };
      }
    } else {
      console.warn(
        `[QBO][patchAdminInvoiceCustomFields] DocNumber=${docNumber} resolves to same id=${staleId} but GET still failed earlier — invoice may have inactive customer/items.`,
      );
    }

    return {
      repaired: true,
      invoice: fetched.invoice,
      repair: {
        method: "docnumber_lookup",
        fromInvoiceId: staleId,
        toInvoiceId: candidateId,
        docNumber,
        relinked,
      },
    };
  }

  return {
    repaired: false,
    reason: "admin_invoice_found_by_docnumber_but_unloadable",
    staleInvoiceId: staleId,
    docNumber,
    candidateInvoiceIds: lookup.ids,
  };
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
 * Stale admin invoice id repair (conservative):
 * When GET by stored `quickBooksInvoiceId` fails with Object Not Found /
 * code 610, we query QBO by `order.invoiceNumber` (DocNumber). If a live
 * invoice is found under a different Id, we relink the DB row and retry
 * the Pullout patch. We never create a new invoice from this path — that
 * avoids duplicate invoices during bulk Pullout sync.
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

  logPulloutPatchRealmDiagnostics({
    orderRow,
    currentRealmId: ADMIN.currentRealmId,
  });

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

  let invoiceRepair = null;
  let fetched = await fetchQboInvoiceById({
    accessToken,
    realmId,
    invoiceId: qboInvoiceId,
  });

  if (!fetched.ok && isStaleInvoiceGetError(fetched.response)) {
    const docNumber = orderRow.invoiceNumber;
    if (docNumber && String(docNumber).trim()) {
      console.warn(
        `[QBO][patchAdminInvoiceCustomFields] GET failed for stored invoice id=${qboInvoiceId} order#${orderRow.id}. Attempting DocNumber repair (doc=${docNumber})...`,
      );
      const repair = await tryRepairStaleAdminInvoiceId({
        accessToken,
        realmId,
        storedInvoiceId: qboInvoiceId,
        docNumber: String(docNumber).trim(),
        orderRow,
        DBMODEL,
      });

      if (repair.repaired && repair.invoice) {
        fetched = { ok: true, invoice: repair.invoice, response: null };
        invoiceRepair = repair.repair;
      } else {
        handleQboError({
          err: { response: fetched.response },
          context:
            "[QBO][patchAdminInvoiceCustomFields] GET invoice failed (repair also failed):",
        });
        return {
          ok: false,
          action: "failed",
          reason: repair.reason || "admin_invoice_get_failed",
          staleInvoiceId: qboInvoiceId,
          docNumber: String(docNumber).trim(),
          candidateInvoiceIds: repair.candidateInvoiceIds ?? null,
          note:
            repair.reason === "admin_invoice_not_found_by_docnumber"
              ? "Stored quickBooksInvoiceId is stale and no QBO invoice matches this DocNumber. Re-sync the admin invoice for this order manually — this path does not create invoices to avoid duplicates."
              : repair.reason ===
                  "admin_invoice_found_by_docnumber_but_unloadable"
                ? "QBO lists this DocNumber but the invoice cannot be loaded (often inactive customer or items on the invoice). Fix in QuickBooks, then retry."
                : "Could not load admin QBO invoice and DocNumber repair did not recover.",
          qboFault: fetched.response?.data?.Fault ?? null,
        };
      }
    }
  }

  if (!fetched.ok) {
    handleQboError({
      err: { response: fetched.response },
      context: "[QBO][patchAdminInvoiceCustomFields] GET invoice failed:",
    });
    const msg =
      fetched.response?.data?.Fault?.Error?.[0]?.Message ||
      `Could not load QBO invoice ${qboInvoiceId}`;
    const err = new Error(msg);
    err.statusCode =
      fetched.response?.status === 404 ? 404 : fetched.response?.status || 400;
    err.isPublic = true;
    err.qboResponse = fetched.response?.data;
    throw err;
  }

  const currentInvoice = fetched.invoice;
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
    invoiceRepair,
  };
}

module.exports = {
  patchAdminInvoiceCustomFields,
};
