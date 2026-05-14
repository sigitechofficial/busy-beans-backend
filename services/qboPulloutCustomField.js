/** Payment method on the order row that gates the Pullout QBO custom field.
 *  Comparison is case-insensitive and trimmed (see `isBankCheckPaymentMethod`)
 *  because historical rows carry both `"Bank Check"` and `"bank check"`. */
const PULLOUT_QBO_PAYMENT_METHOD = "Bank Check";
const PULLOUT_QBO_PAYMENT_METHOD_NORMALIZED = "bank check";

const LOG_PREFIX = "[QBO-PULLOUT-CF]";

function orderTag(order) {
  const id = order?.id ?? "?";
  const num = order?.invoiceNumber ?? "?";
  return `order#${id}(invoice=${num})`;
}

/** Case-insensitive, trimmed match against `Bank Check`. */
function isBankCheckPaymentMethod(value) {
  if (value == null) return false;
  return (
    String(value).trim().toLowerCase() === PULLOUT_QBO_PAYMENT_METHOD_NORMALIZED
  );
}

/**
 * Returns a QBO Invoice CustomField entry when all gates pass; otherwise null.
 * Requires env definition id, order.userId, salesRepId, Bank Check, pulloutIntentId.
 * Skipped when the row already reports pulloutIntentIdSynced === 'synced' so we
 * don't repeatedly write the same value to QBO.
 */
function getPulloutCustomFieldEntry(order) {
  const tag = orderTag(order);
  const rawDefId = process.env.QBO_PULLOUT_CUSTOM_FIELD_ID;
  const defId = rawDefId?.trim();
  if (!defId) {
    console.log(
      `${LOG_PREFIX} ${tag} -> SKIP [defId]: value=${JSON.stringify(rawDefId)} expected=non-empty string -> QBO_PULLOUT_CUSTOM_FIELD_ID not set in env`,
    );
    return null;
  }
  if (order?.userId == null) {
    console.log(
      `${LOG_PREFIX} ${tag} -> SKIP [userId]: value=${JSON.stringify(order?.userId)} expected=non-null -> partner order or admin direct order`,
    );
    return null;
  }
  if (order?.salesRepId == null) {
    console.log(
      `${LOG_PREFIX} ${tag} -> SKIP [salesRepId]: value=${JSON.stringify(order?.salesRepId)} expected=non-null -> no local partner attached`,
    );
    return null;
  }
  if (!isBankCheckPaymentMethod(order?.paymentMethod)) {
    console.log(
      `${LOG_PREFIX} ${tag} -> SKIP [paymentMethod]: value=${JSON.stringify(order?.paymentMethod)} expected=${JSON.stringify(PULLOUT_QBO_PAYMENT_METHOD)} (case-insensitive)`,
    );
    return null;
  }
  const pid = order?.pulloutIntentId;
  if (pid == null || String(pid).trim() === "") {
    console.log(
      `${LOG_PREFIX} ${tag} -> SKIP [pulloutIntentId]: value=${JSON.stringify(pid)} expected=non-empty string -> no pullout yet`,
    );
    return null;
  }
  if (order?.pulloutIntentIdSynced === "synced") {
    console.log(
      `${LOG_PREFIX} ${tag} -> SKIP [pulloutIntentIdSynced]: value=${JSON.stringify(order?.pulloutIntentIdSynced)} expected!="synced" -> already synced, no re-write needed`,
    );
    return null;
  }
  const entry = { DefinitionId: defId, StringValue: String(pid).trim() };
  console.log(
    `${LOG_PREFIX} ${tag} -> INCLUDE Pullout CustomField: defId=${defId}, userId=${JSON.stringify(order?.userId)}, salesRepId=${JSON.stringify(order?.salesRepId)}, paymentMethod=${JSON.stringify(order?.paymentMethod)}, pulloutIntentId=${entry.StringValue}, pulloutIntentIdSynced=${JSON.stringify(order?.pulloutIntentIdSynced ?? "not-eligible")}`,
  );
  return entry;
}

/**
 * Checks the static gates (env def id, customer/sales rep, payment method,
 * pulloutIntentId presence). Ignores the sync state. Used by callers that need
 * to decide whether a row is "eligible" for admin custom-field sync.
 */
function isPulloutCustomFieldEligible(order) {
  const tag = orderTag(order);
  const rawDefId = process.env.QBO_PULLOUT_CUSTOM_FIELD_ID;
  const defId = rawDefId?.trim();
  if (!defId) {
    console.log(
      `${LOG_PREFIX} eligibility ${tag} -> false [defId]: value=${JSON.stringify(rawDefId)} expected=non-empty string`,
    );
    return false;
  }
  if (order?.userId == null) {
    console.log(
      `${LOG_PREFIX} eligibility ${tag} -> false [userId]: value=${JSON.stringify(order?.userId)} expected=non-null`,
    );
    return false;
  }
  if (order?.salesRepId == null) {
    console.log(
      `${LOG_PREFIX} eligibility ${tag} -> false [salesRepId]: value=${JSON.stringify(order?.salesRepId)} expected=non-null`,
    );
    return false;
  }
  if (!isBankCheckPaymentMethod(order?.paymentMethod)) {
    console.log(
      `${LOG_PREFIX} eligibility ${tag} -> false [paymentMethod]: value=${JSON.stringify(order?.paymentMethod)} expected=${JSON.stringify(PULLOUT_QBO_PAYMENT_METHOD)} (case-insensitive)`,
    );
    return false;
  }
  const pid = order?.pulloutIntentId;
  if (pid == null || String(pid).trim() === "") {
    console.log(
      `${LOG_PREFIX} eligibility ${tag} -> false [pulloutIntentId]: value=${JSON.stringify(pid)} expected=non-empty string`,
    );
    return false;
  }
  console.log(
    `${LOG_PREFIX} eligibility ${tag} -> true: defId=${defId}, userId=${JSON.stringify(order?.userId)}, salesRepId=${JSON.stringify(order?.salesRepId)}, paymentMethod=${JSON.stringify(order?.paymentMethod)}, pulloutIntentId=${String(pid).trim()}, pulloutIntentIdSynced=${JSON.stringify(order?.pulloutIntentIdSynced ?? "not-eligible")}`,
  );
  return true;
}

module.exports = {
  getPulloutCustomFieldEntry,
  isPulloutCustomFieldEligible,
  PULLOUT_QBO_PAYMENT_METHOD,
};
