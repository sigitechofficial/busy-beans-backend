// services/qboDeleteInvoice.js — delete QBO invoice(s) only; order stays in DB (admin + partner)
// orderType: "local-partner" → only delete partner invoice (do not touch admin). Otherwise delete both when present.
const { order, account } = require("../models");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const axios = require("axios");
const { QBO, MINOR, headers } = require("./qboHelpers");

async function deleteInvoiceInRealm(accessToken, realmId, invoiceId) {
  const deleteUrl = `${QBO(realmId)}/invoice?operation=delete&minorversion=${MINOR}`;
  const payload = { Id: String(invoiceId), SyncToken: "0" };
  await axios.post(deleteUrl, payload, {
    headers: {
      ...headers(accessToken),
      "Content-Type": "application/json",
    },
  });
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

module.exports = { quickBooksInvocieDelete };
