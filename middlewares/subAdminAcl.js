const AppError = require("../utils/appError");
const { hasPermissionKey } = require("../utils/hqOperator");

const SKIP_PATHS = [
  /^\/api\/v1\/admin\/login/i,
  /^\/api\/v1\/admin\/resend-otp/i,
  /^\/api\/v1\/admin\/otp-verification/i,
  /^\/api\/v1\/admin\/reset-password/i,
  /^\/api\/v1\/admin\/forgot/i,
  /^\/api\/v1\/admin\/logout/i,
];

/** Authenticated self-service; does not use sub-admins_* management keys. */
const SELF_PROFILE_PATHS = [/^\/api\/v1\/admin\/sub-admin\/me\/?$/i];

const READ_LIKE_POST = [
  /fetch-/i,
  /email-helper/i,
  /email-log/i,
  /navigation-counts/i,
  /orders-list/i,
  /kanban/i,
];

const DOMAIN_RULES = [
  { test: /\/admin-reports/i, domain: "report" },
  { test: /\/qbo-customer/i, domain: "quickbooks" },
  { test: /\/quickbooks-/i, domain: "quickbooks-invoices" },
  { test: /\/sub-admin/i, domain: "sub-admins" },
  { test: /\/employee/i, domain: "employees" },
  { test: /\/product/i, domain: "product" },
  { test: /\/inventory/i, domain: "product" },
  { test: /\/sku/i, domain: "product" },
  { test: /\/category/i, domain: "category" },
  { test: /\/supplier/i, domain: "supplier" },
  { test: /\/sales-rep/i, domain: "local-partner" },
  { test: /\/sales_rep/i, domain: "local-partner" },
  { test: /\/customer/i, domain: "customer" },
  { test: /\/add-customer/i, domain: "customer" },
  { test: /\/view-customer/i, domain: "customer" },
  { test: /\/delete-customer/i, domain: "customer" },
  { test: /\/partner-order/i, domain: "orders" },
  { test: /\/book-new/i, domain: "orders" },
  { test: /\/assign-supplier/i, domain: "orders" },
  { test: /\/order/i, domain: "orders" },
  { test: /\/invoice/i, domain: "invoice" },
  { test: /\/cheque/i, domain: "invoice" },
  { test: /\/pullout/i, domain: "payment-pullout" },
  { test: /\/address-management\/country/i, domain: "country" },
  { test: /\/address-management/i, domain: "country" },
  { test: /\/shipping/i, domain: "charges" },
  { test: /\/charge/i, domain: "charges" },
  { test: /\/report/i, domain: "report" },
  { test: /\/dashboard/i, domain: "dashboard" },
  { test: /\/api\/v1\/leads/i, domain: "leads-dashboard" },
  { test: /\/lead/i, domain: "leads-dashboard" },
  { test: /\/get-in-touch/i, domain: "free-tasting" },
  { test: /\/free-tasting/i, domain: "free-tasting" },
  { test: /\/coffee-machine/i, domain: "subscription" },
  { test: /\/subscription/i, domain: "subscription" },
  { test: /\/addon/i, domain: "subscription" },
  { test: /\/qbo/i, domain: "quickbooks" },
  { test: /\/quickbook/i, domain: "quickbooks" },
  { test: /\/profile/i, domain: null },
  { test: /\/payout/i, domain: null },
  { test: /\/stripe-connect/i, domain: null },
  { test: /\/transfer-commission/i, domain: null },
];

const deny = (next, message = "You do not have permission to perform this action") =>
  next(new AppError(message, 403, "permission-fail"));

const resolveDomain = (url) => {
  for (const rule of DOMAIN_RULES) {
    if (rule.test.test(url)) return rule.domain;
  }
  return undefined;
};

const resolveAction = (method, url) => {
  const m = String(method || "GET").toUpperCase();
  if (m === "GET") return "view";
  if (m === "DELETE") return "delete";
  if (m === "PATCH" || m === "PUT") return "update";
  if (m === "POST") {
    if (READ_LIKE_POST.some((re) => re.test(url))) return "view";
    return "create";
  }
  return "view";
};

exports.enforceSubAdminAcl = (req, res, next) => {
  if (req.user?.entity !== "subAdmin") return next();

  const url = `${req.originalUrl || req.url || ""}`.split("?")[0];
  if (SKIP_PATHS.some((re) => re.test(url))) return next();
  if (SELF_PROFILE_PATHS.some((re) => re.test(url))) return next();

  const domain = resolveDomain(url);
  if (domain === null) {
    if (/\/profile/i.test(url)) {
      return deny(next, "HQ admin profile is not available to sub-admins");
    }
    if (/\/payout/i.test(url)) {
      return deny(next, "Payouts are not available to sub-admins");
    }
    if (/\/stripe-connect/i.test(url)) {
      return deny(next, "Stripe Connect is not available to sub-admins");
    }
    if (/\/transfer-commission/i.test(url)) {
      return deny(next, "Commission transfers are not available to sub-admins");
    }
    return deny(next);
  }
  if (domain === undefined) {
    return deny(next, "This admin action is not available to sub-admins");
  }

  const action = resolveAction(req.method, url);
  const key = `${domain}_${action}`;
  if (!hasPermissionKey(req, key)) {
    if (action !== "view" && hasPermissionKey(req, `${domain}_view`) === false) {
      return deny(next);
    }
    return deny(next, `Missing permission ${key}`);
  }
  return next();
};
