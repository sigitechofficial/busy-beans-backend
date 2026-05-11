/** Payment method on the order row that gates the Pullout QBO custom field */
const PULLOUT_QBO_PAYMENT_METHOD = "Bank Check";

/**
 * Returns a QBO Invoice CustomField entry when all gates pass; otherwise null.
 * Requires env definition id, order.userId, salesRepId, Bank Check, pulloutIntentId.
 */
function getPulloutCustomFieldEntry(order) {
  const defId = process.env.QBO_PULLOUT_CUSTOM_FIELD_ID?.trim();
  if (!defId) return null;
  if (order?.userId == null) return null;
  if (order?.salesRepId == null) return null;
  if (order?.paymentMethod !== PULLOUT_QBO_PAYMENT_METHOD) return null;
  const pid = order?.pulloutIntentId;
  if (pid == null || String(pid).trim() === "") return null;
  return { DefinitionId: defId, StringValue: String(pid).trim() };
}

module.exports = {
  getPulloutCustomFieldEntry,
  PULLOUT_QBO_PAYMENT_METHOD,
};
