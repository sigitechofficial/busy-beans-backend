/**
 * Private admin API (/api/v1/admin/*, after `protect`): what each kind of account may reach.
 *
 *   admin, sub-admin     → everything (sub-admins are already limited by their permissions, subAdminAcl.js)
 *   admin employee       → everything; permission keys checked in log mode (EMPLOYEE_ACL_MODE=enforce blocks)
 *   customer ("user")    → only the shipping-cost call both websites make at checkout, for themselves
 *   supplier             → only the supplier panel's calls, for orders assigned to that supplier
 *   local partner /
 *   partner employee     → their own data only: a partner id in the URL / query / body is replaced
 *                          by their own (partner employees' screens send their employee id there);
 *                          customers, orders and employees in the URL or body must be theirs;
 *                          HQ-only admin actions are refused
 *
 * Refusals answer 404 for records ("not found", so ids can't be probed) and 403 for actions.
 * Order status updates (acknowledge / dispatch / deliver / cancel / edit / cheque) only accept the
 * order fields that account may change (orderData allow-list).
 */
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { order, partnerOrder, user, employee, chequeDetail } = require("../models");
const { getPermissionKeys } = require("../utils/hqOperator");

const PARTNERS = ["localPartner", "partnerEmployee"];
const forbidden = () => new AppError("You do not have permission to perform this action", 403, "permission-fail");
const notFound = () => new AppError("Not found", 404);

/* ---------- path patterns (paths are relative to /api/v1/admin) ---------- */

/** Partner id in the URL: must be the partner's own id. */
const PARTNER_ID_PATHS = [
  /^\/add-customer\/sales-rep\/([^/]+)/,
  /^\/attach-bank-account-setup\/sales-rep\/([^/]+)/,
  /^\/create-bank-setup-intent\/sales-rep\/([^/]+)/,
  /^\/create-stripe-connect-account\/([^/]+)/,
  /^\/stripe-connect-account-(?:dashboard|retrieve|url)\/([^/]+)/,
  /^\/customer-management\/customer-list\/sale-rep-id\/([^/]+)/,
  /^\/customer-management\/invoice-customers-balance\/sales-rep\/([^/]+)/,
  /^\/dashboard\/local-partner-sales\/([^/]+)/,
  /^\/order-frequency\/(?:book-orders|upcomming-orders)\/sale-rep\/([^/]+)/,
  /^\/order-navigation-counts\/sales-rep\/([^/]+)/,
  /^\/partner-order-navigation-counts\/sales-rep\/([^/]+)/,
  /^\/orders-pending-pullouts\/([^/]+)/,
  /^\/products\/sales-rep\/import\/([^/]+)/,
  /^\/pull-payments-from-patners-banka-account\/([^/]+)/,
  /^\/sales-rep-dashboard\/([^/]+)/,
  /^\/sales-rep-products-for-order-creation\/([^/]+)/,
  /^\/sales-rep-reports\/[^/]+\/([^/]+)/,
  /^\/sales-rep\/(?:address-update|book-new-order|for-order-creation|sales)\/([^/]+)/,
  /^\/send-quotation\/sales-rep\/([^/]+)/,
];

/** Customer id in the URL. */
const CUSTOMER_ID_PATHS = [
  /^\/view-customer-detail\/([^/]+)/,
  /^\/customer-update\/([^/]+)/,
  /^\/customer-approve\/([^/]+)/,
  /^\/delete-customer\/([^/]+)/,
  /^\/customer-discounts\/([^/]+)/,
  /^\/customer-management\/payment-cards\/([^/]+)/,
  /^\/shipping-charges-on-weight\/customer\/([^/]+)/,
  /^\/admin-reports\/customer-detail-report\/([^/]+)/,
  /^\/audit\/customer\/([^/]+)/,
];

/** Customer order id in the URL. */
const ORDER_ID_PATHS = [/^\/order-details\/([^/]+)/, /^\/order-management\/delete-order\/([^/]+)/];
/** Partner order (HQ → partner) id in the URL. */
const PARTNER_ORDER_ID_PATHS = [/^\/partner-order\/order-details\/([^/]+)/, /^\/partner-order\/pull-payment-from-bank\/([^/]+)/];

/** Order status / cheque actions: order id in the body (orderId or partnerOrderId). */
const JOURNEY_PATHS = /^\/(assign-supplier|supplier-acknowledgement|order-dispatch|order-deliver|order-cancel|edit-order|add-cheque)\/?$/;

/** HQ-only actions: never for partners or suppliers. */
const HQ_ONLY_PATHS = [
  /^\/customer-management\/assign-sale-rep\//,
  /^\/qbo\/(?:payments|invoices)\/(?:delete|sync|update)-admin/,
  /^\/qbo\/synced-orders-admin-before-march-2026/,
  /^\/dashboard\/admin-employee/,
  /^\/sub-admin/,
  /^\/supplier-reports\//,
  /^\/supplier-dashboard\//,
  /^\/order-navigation-counts\/supplier\//,
  /^\/partner-order-navigation-counts\/supplier\//,
  /^\/audit\/(?!customer\/)/,
];

/** Supplier panel (everything else is refused for suppliers). */
const SUPPLIER_ALLOWED = [
  { method: "GET", path: /^\/orders\/?$/ },
  { method: "GET", path: /^\/partner-order\/orders-list\/?$/ },
  { method: "GET", path: /^\/order-details\/[^/]+$/ },
  { method: "GET", path: /^\/partner-order\/order-details\/[^/]+$/ },
  { method: "PATCH", path: /^\/(supplier-acknowledgement|order-dispatch|order-deliver)\/?$/ },
  { method: "PATCH", path: /^\/order-management\/update-tracking-number\/?$/ },
  { method: "GET", path: /^\/supplier-reports\/(?:assigned-orders-report|top-products-ordered-report)\/[^/]+$/ },
  { method: "GET", path: /^\/supplier-dashboard\/[^/]+$/ },
  { method: "GET", path: /^\/(?:partner-)?order-navigation-counts\/supplier\/[^/]+$/ },
];
const SUPPLIER_ID_PATHS = [
  /^\/supplier-reports\/[^/]+\/([^/]+)/,
  /^\/supplier-dashboard\/([^/]+)/,
  /^\/(?:partner-)?order-navigation-counts\/supplier\/([^/]+)/,
];

/** Customers: only the checkout shipping cost (both websites). */
const CUSTOMER_ALLOWED = [{ method: "POST", path: /^\/shipping-charges-on-weight\/customer\/[^/]+$/ }];

/* orderData fields each account may change through the order status endpoints. */
const SUPPLIER_ORDER_FIELDS = ["statusId", "trackingNumber", "shippingCompany", "orderStatus"];
const PARTNER_BLOCKED_ORDER_FIELDS = [
  "id",
  "userId",
  "salesRepId",
  "totalBill",
  "itemsPrice",
  "subTotal",
  "discountPrice",
  "invoiceId",
  "hostedInvoiceUrl",
  "invoiceNumber",
  "adminReceivableAmount",
  "adminReceivableStatus",
  "localPatnerCommission",
  "proportionalStripeFee",
  "paymentIntentId",
  "pulloutIntentId",
  "payToken",
  "payLinkLegacy",
  "quickBooksInvoiceId",
  "quickBooksPaymentId",
];

/* ---------- helpers ---------- */

const firstMatch = (patterns, path) => {
  for (const re of patterns) {
    const m = path.match(re);
    if (m) return m;
  }
  return null;
};
const same = (a, b) => a !== undefined && a !== null && String(a) === String(b);

/** Replace the id captured by `match` (group 1) in the request path with `ownId`. */
function rewritePathId(req, match, ownId) {
  const start = match.index + match[0].lastIndexOf(match[1]);
  const newPath = req.path.slice(0, start) + String(ownId) + req.path.slice(start + match[1].length);
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  req.url = newPath + qs;
}

async function partnerOwnsCustomer(partnerId, customerId) {
  const row = await user.findOne({ where: { id: customerId }, attributes: ["salesRepId"], raw: true });
  return Boolean(row) && same(row.salesRepId, partnerId);
}
async function orderRow(Model, id) {
  if (!id) return null;
  return Model.findOne({ where: { id }, attributes: ["id", "salesRepId", "supplierId"], raw: true });
}
const ownsOrder = (reqUser, row) => {
  if (!row) return false;
  if (PARTNERS.includes(reqUser.entity)) return same(row.salesRepId, reqUser.localPartnerId);
  if (reqUser.entity === "supplier") return same(row.supplierId, reqUser.id);
  return false;
};

function sanitizeOrderData(req) {
  const data = req.body?.orderData;
  if (!data || typeof data !== "object") return;
  if (req.user.entity === "supplier") {
    req.body.orderData = Object.fromEntries(Object.entries(data).filter(([k]) => SUPPLIER_ORDER_FIELDS.includes(k)));
  } else if (PARTNERS.includes(req.user.entity)) {
    req.body.orderData = Object.fromEntries(Object.entries(data).filter(([k]) => !PARTNER_BLOCKED_ORDER_FIELDS.includes(k)));
  }
}

/* ---------- employee permission keys (log mode first) ---------- */

let employeeAclRules = null;
function employeeVerdict(req) {
  // Lazy: reuse the sub-admin URL → feature mapping.
  // eslint-disable-next-line global-require
  if (!employeeAclRules) employeeAclRules = require("./subAdminAcl").__internals;
  if (!employeeAclRules) return { checked: false };
  const url = `${req.originalUrl || req.url || ""}`.split("?")[0];
  const domains = employeeAclRules.domainsFor(url);
  if (!domains || !domains.length) return { checked: false };
  const action = employeeAclRules.actionFor(req.method, url);
  const keys = getPermissionKeys(req.user);
  const ok = domains.some((d) => keys.includes(`${d}_${action}`));
  return { checked: true, ok, need: `${domains[0]}_${action}` };
}

/* ---------- middleware ---------- */

module.exports = catchAsync(async (req, res, next) => {
  const reqUser = req.user;
  const entity = reqUser?.entity;
  const path = req.path;
  const method = req.method.toUpperCase();

  if (entity === "admin" || entity === "subAdmin") return next();

  if (entity === "user") {
    const allowed = CUSTOMER_ALLOWED.find((r) => r.method === method && r.path.test(path));
    if (!allowed) return next(forbidden());
    const m = firstMatch(CUSTOMER_ID_PATHS, path);
    if (!m || !same(m[1], reqUser.id)) return next(notFound());
    return next();
  }

  if (entity === "adminEmployee" || entity === "partnerEmployee") {
    const verdict = employeeVerdict(req);
    if (verdict.checked && !verdict.ok) {
      if (process.env.EMPLOYEE_ACL_MODE === "enforce") return next(forbidden());
      console.warn(`[employee-acl] would refuse ${entity}#${reqUser.id} ${method} ${path} (missing ${verdict.need})`);
    }
    if (entity === "adminEmployee") return next();
  }

  if (entity === "supplier") {
    const allowed = SUPPLIER_ALLOWED.find((r) => r.method === method && r.path.test(path));
    if (!allowed) return next(forbidden());
    const sid = firstMatch(SUPPLIER_ID_PATHS, path);
    if (sid && !same(sid[1], reqUser.id)) rewritePathId(req, sid, reqUser.id);
    if (/^\/(orders|partner-order\/orders-list)\/?$/.test(path)) {
      req.query.supplierId = String(reqUser.id); // a supplier's lists are always their own
    }
  } else if (PARTNERS.includes(entity)) {
    if (firstMatch(HQ_ONLY_PATHS, path)) return next(forbidden());
    const own = reqUser.localPartnerId;
    if (!own) return next(forbidden());
    const pid = firstMatch(PARTNER_ID_PATHS, path);
    if (pid && !same(pid[1], own)) rewritePathId(req, pid, own);
    for (const src of [req.query, req.body]) {
      if (src && typeof src === "object" && src.salesRepId !== undefined && src.salesRepId !== null && src.salesRepId !== "") {
        src.salesRepId = String(own);
      }
    }
    const cid = firstMatch(CUSTOMER_ID_PATHS, req.path);
    if (cid && !(await partnerOwnsCustomer(own, cid[1]))) return next(notFound());
    const emp = path.match(/^\/customer-management\/customer-list\/employee-id\/([^/]+)/);
    if (emp) {
      const row = await employee.findOne({ where: { id: emp[1] }, attributes: ["salesRepId"], raw: true });
      if (!row || !same(row.salesRepId, own)) return next(notFound());
    }
  } else {
    return next(forbidden());
  }

  // Records in the URL or body (partners and suppliers).
  const oid = firstMatch(ORDER_ID_PATHS, path);
  if (oid && !ownsOrder(reqUser, await orderRow(order, oid[1]))) return next(notFound());
  const poid = firstMatch(PARTNER_ORDER_ID_PATHS, path);
  if (poid && !ownsOrder(reqUser, await orderRow(partnerOrder, poid[1]))) return next(notFound());
  const tracking = path.match(/^\/order-management\/invoice-tracking\/([^/]+)\/([^/]+)/);
  if (tracking) {
    const Model = tracking[1] === "partner-order" ? partnerOrder : order;
    if (!ownsOrder(reqUser, await orderRow(Model, tracking[2]))) return next(notFound());
  }
  const activity = path.match(/^\/order-management\/activity\/([^/]+)\/([^/]+)/);
  if (activity) {
    const Model = activity[1] === "partner" ? partnerOrder : order;
    if (!ownsOrder(reqUser, await orderRow(Model, activity[2]))) return next(notFound());
  }
  if (JOURNEY_PATHS.test(path)) {
    const { orderId, partnerOrderId } = req.body || {};
    const row = partnerOrderId ? await orderRow(partnerOrder, partnerOrderId) : await orderRow(order, orderId);
    if (!ownsOrder(reqUser, row)) return next(notFound());
    sanitizeOrderData(req);
  }
  if (/^\/edit-cheque\/?$/.test(path)) {
    const cheque = req.body?.chequeId
      ? await chequeDetail.findOne({ where: { id: req.body.chequeId }, attributes: ["orderId", "partnerOrderId"], raw: true })
      : null;
    const row = cheque?.partnerOrderId ? await orderRow(partnerOrder, cheque.partnerOrderId) : await orderRow(order, cheque?.orderId);
    if (!ownsOrder(reqUser, row)) return next(notFound());
  }
  if (/^\/order-management\/update-tracking-number\/?$/.test(path)) {
    const { orderId, orderType } = req.body || {};
    const Model = orderType === "local-partner" || orderType === "partner-order" ? partnerOrder : order;
    if (!ownsOrder(reqUser, await orderRow(Model, orderId))) return next(notFound());
  }
  if (/^\/order-management\/delete-invoice\/?$/.test(path)) {
    const { orderType, id } = req.body || {};
    const Model = orderType === "partnerOrder" ? partnerOrder : order;
    if (!ownsOrder(reqUser, await orderRow(Model, id))) return next(notFound());
  }
  return next();
});
