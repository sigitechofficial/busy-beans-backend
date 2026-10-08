/**
 * Who may edit / send an order's invoice (customer orders and partner orders).
 *
 *   HQ admin / admin employee             → any order
 *   sub-admin                             → any order its permissions and scope cover (below)
 *   local partner / partner employee      → only orders of that partner (order.salesRepId)
 *   anyone else (customers, suppliers)    → never (the routes also restrict these entities)
 *
 * Sub-admins also need the right data scope for that kind of order (the URL-based ACL lets any of
 * Order Management / Customer Orders / Partner Orders through on /order-management/*):
 *   HQ customer order          → customer-orders_<action>, or orders_<action> with the Admin scope
 *   local partner's customer   → customer-orders_<action>, or orders_<action> with the Local Partner scope
 *   partner order (HQ → partner) → partner-orders_<action>, or orders_<action> with the Local Partner scope
 */
const { getPermissionKeys, hasFeatureScope } = require("./hqOperator");

const INVOICE_EDITOR_ENTITIES = ["admin", "subAdmin", "adminEmployee", "localPartner", "partnerEmployee"];

/** Order fields the invoice screens may set; everything else on an order is server-managed. */
const EDITABLE_ORDER_FIELDS = [
  "invoiceNumber",
  "poNumber",
  "termDays",
  "note",
  "invoiceDate",
  "invoiceReminder",
  "discountPercentage",
  "shippingCharges",
  "vat",
];

/** Fields "Send invoice" may set (invoice date / reminder stamps). */
const SEND_INVOICE_FIELDS = ["invoiceDate", "invoiceReminder"];

/**
 * @param {object} user        req.user
 * @param {number|null} salesRepId order.salesRepId
 * @param {{ kind?: "customer"|"partner", action?: "update"|"create" }} [opts]
 *   kind: customer order (orders table) or partner order (partnerOrders); action: the ACL action
 *   of the request (PATCH = update, POST = create)
 */
function canAccessOrder(user, salesRepId, { kind = "customer", action = "update" } = {}) {
  if (!user || !INVOICE_EDITOR_ENTITIES.includes(user.entity)) return false;
  if (user.entity === "localPartner" || user.entity === "partnerEmployee") {
    return Boolean(user.localPartnerId) && Number(user.localPartnerId) === Number(salesRepId);
  }
  if (user.entity === "subAdmin") {
    const keys = getPermissionKeys(user);
    const scope = kind === "partner" || salesRepId ? "partner" : "customer";
    const pageKey = kind === "partner" ? `partner-orders_${action}` : `customer-orders_${action}`;
    if (keys.includes(pageKey)) return true;
    return keys.includes(`orders_${action}`) && hasFeatureScope({ user }, "orders", scope);
  }
  return true;
}

function pickFields(source, fields) {
  const out = {};
  if (!source || typeof source !== "object") return out;
  for (const key of fields) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

/** A card payment or bank pull exists (or the order is paid): the invoice can no longer change. */
function paymentLocked(placedOrder) {
  return placedOrder?.paymentStatus === "done" || Boolean(placedOrder?.paymentIntentId) || Boolean(placedOrder?.pulloutIntentId);
}

module.exports = {
  INVOICE_EDITOR_ENTITIES,
  EDITABLE_ORDER_FIELDS,
  SEND_INVOICE_FIELDS,
  canAccessOrder,
  pickFields,
  paymentLocked,
};
