// services/qboDeleteInvoice.js — delete QBO invoice(s) only; order stays in DB (admin + partner)
// orderType: "local-partner" → only delete partner invoice (do not touch admin). Otherwise delete both when present.
const { Op } = require("sequelize");
const { order, account, partnerOrder } = require("../models");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const axios = require("axios");
const { QBO, MINOR, headers } = require("./qboHelpers");

async function deleteInvoiceInRealm(accessToken, realmId, invoiceId) {
  const safeId = String(invoiceId).trim();
  const getUrl = `${QBO(realmId)}/invoice/${safeId}?minorversion=${MINOR}`;
  const getRes = await axios.get(getUrl, { headers: headers(accessToken) });
  const inv = getRes?.data?.Invoice;
  const syncToken = inv?.SyncToken ?? "0";

  const deleteUrl = `${QBO(realmId)}/invoice?operation=delete&minorversion=${MINOR}`;
  await axios.post(
    deleteUrl,
    { Id: safeId, SyncToken: syncToken },
    {
      headers: {
        ...headers(accessToken),
        "Content-Type": "application/json",
      },
    },
  );
}

async function quickBooksInvocieDelete({ orderId, orderType }) {
  if (!orderId) throw new Error("Missing orderId");

  // Only columns used: id, quickBooksInvoiceId (admin), quickBooksInvoiceIdPartner, partnerRealmId, salesRepId (partner token)
  const ord = await order.findOne({
    where: { id: orderId },
    attributes: [
      "id",
      "quickBooksInvoiceId",
      "quickBooksInvoiceIdPartner",
      "partnerRealmId",
      "salesRepId",
    ],
  });

  if (!ord) throw new Error(`Order ${orderId} not found`);

  const isLocalPartner = orderType === "local-partner";
  const hasAdmin = !isLocalPartner && !!ord.quickBooksInvoiceId;
  const hasPartner = !!ord.quickBooksInvoiceIdPartner && !!ord.partnerRealmId;

  if (!hasAdmin && !hasPartner) {
    return {
      status: "success",
      message: `Order ${orderId} has no QuickBooks invoice to delete.`,
      quickBooksInvoiceId: null,
      quickBooksInvoiceIdPartner: null,
    };
  }

  const updatePayload = {};
  const deleted = { admin: null, partner: null };

  try {
    // ——— Admin (main) QBO invoice ——— (skipped for local-partner; admin has nothing to do with that order)
    if (hasAdmin) {
      const ADMIN = await account.findOne({});
      if (!ADMIN?.currentRealmId || !ADMIN?.id)
        throw new Error("Admin QBO not connected (missing realm or account).");

      const adminQboCondition = {
        realmId: ADMIN.currentRealmId,
        accountId: ADMIN.id,
      };
      const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
        condition: adminQboCondition,
      });

      if (!accessToken || !realmId)
        throw new Error("QBO credentials missing or disconnected");

      await deleteInvoiceInRealm(accessToken, realmId, ord.quickBooksInvoiceId);
      console.log(
        `[QBO][DeleteInvoice] Deleted admin invoice ${ord.quickBooksInvoiceId} for order ${orderId}`,
      );
      deleted.admin = ord.quickBooksInvoiceId;
      updatePayload.quickBooksInvoiceId = null;
      updatePayload.qboLastSync = null;
    }

    // ——— Partner QBO invoice ———
    if (hasPartner) {
      const partnerCondition = {
        realmId: ord.partnerRealmId,
        salesRepId: ord.salesRepId,
      };
      const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
        condition: partnerCondition,
      });

      if (!accessToken || !realmId)
        throw new Error("Partner QBO credentials missing or disconnected");

      await deleteInvoiceInRealm(
        accessToken,
        realmId,
        ord.quickBooksInvoiceIdPartner,
      );
      console.log(
        `[QBO][DeleteInvoice] Deleted partner invoice ${ord.quickBooksInvoiceIdPartner} for order ${orderId}`,
      );
      deleted.partner = ord.quickBooksInvoiceIdPartner;
      updatePayload.quickBooksInvoiceIdPartner = null;
      updatePayload.partnerRealmId = null;
      updatePayload.quickBooksPaymentIdPartner = null;
    }

    if (Object.keys(updatePayload).length) {
      await order.update(updatePayload, { where: { id: ord.id } });
    }

    const parts = [];
    if (deleted.admin) parts.push("admin");
    if (deleted.partner) parts.push("partner");

    return {
      status: "success",
      message: `QuickBooks invoice(s) deleted for order ${orderId} (${parts.join(" + ")}). Order kept in database.`,
      quickBooksInvoiceId: deleted.admin,
      quickBooksInvoiceIdPartner: deleted.partner,
    };
  } catch (err) {
    console.error(
      `[QBO][DeleteInvoice] Failed for order ${orderId}:`,
      err.response?.data || err.message,
    );
    throw err;
  }
}

/**
 * Delete **admin** QBO invoices for many orders; clear invoice + admin payment fields in DB on success.
 * Deduplicates by QBO invoice id.
 *
 * @param {Object} opts
 * @param {number[]} opts.orderIds
 * @param {'customer'|'local-partner'} [opts.orderType='customer']
 */
async function deleteAdminQboInvoicesForOrders({
  orderIds,
  orderType = "customer",
} = {}) {
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error("orderIds must be a non-empty array.");
  }

  const ADMIN = await account.findOne({});
  if (!ADMIN?.currentRealmId || !ADMIN?.id) {
    throw new Error("Admin QuickBooks is not connected (missing currentRealmId).");
  }

  const condition = {
    realmId: ADMIN.currentRealmId,
    accountId: ADMIN.id,
  };

  const MODEL = orderType === "local-partner" ? partnerOrder : order;
  const numericIds = [
    ...new Set(
      orderIds
        .map((id) => Number(id))
        .filter((n) => !Number.isNaN(n) && n > 0),
    ),
  ];
  if (numericIds.length === 0) {
    throw new Error("orderIds must contain valid numeric ids.");
  }

  const rows = await MODEL.findAll({
    where: { id: { [Op.in]: numericIds }, deleted: false },
    attributes: ["id", "quickBooksInvoiceId"],
  });

  const foundIdSet = new Set(rows.map((r) => r.id));
  const ordersNotFound = numericIds.filter((id) => !foundIdSet.has(id));

  const invoiceToOrderIds = new Map();
  const skippedNoAdminInvoice = [];

  for (const row of rows) {
    const raw = row.quickBooksInvoiceId;
    if (raw == null || String(raw).trim() === "") {
      skippedNoAdminInvoice.push(row.id);
      continue;
    }
    const invoiceId = String(raw).trim();
    if (!invoiceToOrderIds.has(invoiceId)) {
      invoiceToOrderIds.set(invoiceId, []);
    }
    invoiceToOrderIds.get(invoiceId).push(row.id);
  }

  const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
    condition,
  });
  if (!accessToken || !realmId) {
    throw new Error("QBO credentials missing or disconnected.");
  }

  const deletedInvoices = [];
  const failedInvoices = [];

  for (const [invoiceId, affectedOrderIds] of invoiceToOrderIds) {
    try {
      await deleteInvoiceInRealm(accessToken, realmId, invoiceId);
      console.log(
        `[QBO][DeleteInvoice][bulk] Deleted admin invoice ${invoiceId} for order(s) ${affectedOrderIds.join(",")}`,
      );
      await MODEL.update(
        {
          quickBooksInvoiceId: null,
          quickBooksPaymentId: null,
          paymentSyncedToQBO: false,
          qboLastSync: new Date(),
        },
        { where: { id: { [Op.in]: affectedOrderIds } } },
      );
      deletedInvoices.push({ invoiceId, orderIds: affectedOrderIds });
    } catch (err) {
      const message =
        err?.response?.data?.Fault?.Error?.[0]?.Message ||
        err?.message ||
        "Unknown error";
      failedInvoices.push({
        invoiceId,
        orderIds: affectedOrderIds,
        message,
      });
    }
  }

  return {
    deletedInvoices,
    failedInvoices,
    skippedNoAdminInvoice,
    ordersNotFound,
    orderType,
    summary: {
      invoicesDeleted: deletedInvoices.length,
      invoicesFailed: failedInvoices.length,
      ordersUpdated: deletedInvoices.reduce(
        (n, d) => n + d.orderIds.length,
        0,
      ),
      skippedNoAdminInvoice: skippedNoAdminInvoice.length,
      ordersNotFound: ordersNotFound.length,
    },
  };
}

module.exports = {
  quickBooksInvocieDelete,
  deleteAdminQboInvoicesForOrders,
  deleteInvoiceInRealm,
};
