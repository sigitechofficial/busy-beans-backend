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

/**
 * Sparse-update **admin** QBO invoice custom fields only (no line items, dates, etc.).
 * Currently applies **Pullout** when `getPulloutCustomFieldEntry` passes.
 *
 * - Gates not met → `{ ok: true, action: 'skipped', reason: 'pullout_gates_not_met' }`
 * - Admin sync skipped (direct-partner / dropship rules) → skipped with reason
 * - Gates met, no `quickBooksInvoiceId` → `syncInvoiceOnQuikBooks` (create path includes Pullout)
 * - Gates met, invoice exists → GET merge `CustomField` for Pullout definition, POST sparse
 * - Paid invoice (Balance 0) → skipped (same policy as full invoice update)
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
  if (Number(currentInvoice.Balance || 0) === 0) {
    return { ok: true, action: "skipped", reason: "invoice_already_paid" };
  }

  const existingRows = normalizeQboCustomFieldArray(currentInvoice.CustomField);
  const existingPullout = existingRows.find(
    (r) => String(r.DefinitionId) === String(pulloutCf.DefinitionId),
  );
  if (
    existingPullout &&
    String(existingPullout.StringValue || "").trim() === pulloutCf.StringValue
  ) {
    return { ok: true, action: "skipped", reason: "pullout_already_set" };
  }

  const mergedCustomFields = mergePulloutIntoCustomFields(
    currentInvoice.CustomField,
    pulloutCf,
  );

  const payload = {
    Id: String(currentInvoice.Id),
    SyncToken: String(currentInvoice.SyncToken),
    sparse: true,
    CustomField: mergedCustomFields,
  };

  const postUrl = `${QBO(realmId)}/invoice?minorversion=${MINOR_CUSTOM_FIELDS}&include=enhancedAllCustomFields`;
  const postRes = await axios.post(postUrl, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    validateStatus: () => true,
  });

  if (postRes.status < 200 || postRes.status >= 300 || !postRes.data?.Invoice) {
    handleQboError({
      err: { response: postRes },
      context: "[QBO][patchAdminInvoiceCustomFields] POST invoice failed:",
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

  await DBMODEL.update(
    { qboLastSync: new Date() },
    { where: { id: orderRow.id } },
  );

  return {
    ok: true,
    action: "patched_custom_fields",
    invoiceId: postRes.data.Invoice.Id,
    customField: pulloutCf,
  };
}

module.exports = {
  patchAdminInvoiceCustomFields,
};
