const AppError = require("../utils/appError");
const {
  hasPermissionKey,
  hasFeatureScope,
  userHasFeatureKeys,
} = require("../utils/hqOperator");

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
  { test: /\/partner-order/i, domain: "partner-orders" },
  { test: /\/order-navigation-counts/i, domain: "customer-orders" },
  { test: /\/order-details/i, domain: "customer-orders" },
  { test: /\/order-frequency/i, domain: "customer-orders" },
  { test: /\/admin\/orders(?:\/|$)/i, domain: "customer-orders" },
  {
    test: /\/order-management/i,
    domains: ["orders", "customer-orders", "partner-orders"],
  },
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

const urlIndicatesInvoiceList = (url) =>
  /invoiceDate/i.test(url) || /[?&]type=direct-invoice(?:&|$)/i.test(url);

const urlIndicatesPartnerSide = (url) =>
  /\/partner-order/i.test(url) ||
  /\/quickbooks-partner/i.test(url) ||
  /\/products\/sales-rep/i.test(url);

const PARTNER_REPORT_PATHS =
  /\/admin-reports\/(partner-commission|partner-creadit-limit|unpaid-partner-balance|direct-partner|pulled-orders-receivable)/i;
const CUSTOMER_REPORT_PATHS =
  /\/admin-reports\/customer-report(?:\/|$|\?)/i;

const resolveRequiredScope = (req, url) => {
  if (/\/quickbooks-partner-order-management/i.test(url)) {
    return { feature: "quickbooks-invoices", scope: "partner" };
  }
  if (/\/quickbooks-customer-order-management/i.test(url)) {
    return { feature: "quickbooks-invoices", scope: "customer" };
  }

  if (urlIndicatesInvoiceList(url) && userHasFeatureKeys(req, "invoice")) {
    return {
      feature: "invoice",
      scope: urlIndicatesPartnerSide(url) ? "partner" : "customer",
    };
  }

  if (PARTNER_REPORT_PATHS.test(url)) {
    return { feature: "report", scope: "partner" };
  }
  if (CUSTOMER_REPORT_PATHS.test(url)) {
    return { feature: "report", scope: "customer" };
  }
  if (/\/admin-reports/i.test(url)) {
    const q = `${url}`;
    const wantsPartner =
      /[?&]userType=salesRep(?:&|$)/i.test(q) ||
      /salesRepId=/i.test(q) ||
      /salesRep\[ne\]/i.test(q);
    const wantsCustomer = /[?&]userType=admin(?:&|$)/i.test(q);
    if (wantsPartner) return { feature: "report", scope: "partner" };
    if (wantsCustomer) return { feature: "report", scope: "customer" };
    if (userHasFeatureKeys(req, "report")) {
      const both =
        hasFeatureScope(req, "report", "customer") &&
        hasFeatureScope(req, "report", "partner");
      if (!both) {
        return {
          feature: "report",
          scope: hasFeatureScope(req, "report", "customer")
            ? "partner"
            : "customer",
        };
      }
    }
  }

  if (
    /\/order-management\/(email-helper|delete-invoice)/i.test(url) &&
    userHasFeatureKeys(req, "orders")
  ) {
    const orderType = String(req.body?.orderType || req.query?.orderType || "");
    if (orderType === "local-partner") {
      return { feature: "orders", scope: "partner" };
    }
    if (orderType === "customer") {
      return { feature: "orders", scope: "customer" };
    }
  }

  if (/\/products\/sales-rep/i.test(url)) {
    if (userHasFeatureKeys(req, "invoice") && hasFeatureScope(req, "invoice", "partner")) {
      return { feature: "invoice", scope: "partner" };
    }
    if (userHasFeatureKeys(req, "orders") && hasFeatureScope(req, "orders", "partner")) {
      return { feature: "orders", scope: "partner" };
    }
  }

  if (/invoice-customers-balance/i.test(url)) {
    const partnerSide =
      /\/sales-rep\//i.test(url) || /[?&]owner=partner(?:&|$)/i.test(url);
    if (userHasFeatureKeys(req, "invoice")) {
      return { feature: "invoice", scope: partnerSide ? "partner" : "customer" };
    }
    if (userHasFeatureKeys(req, "orders")) {
      return { feature: "orders", scope: partnerSide ? "partner" : "customer" };
    }
  }

  if (/\/customer-list\/sale-rep-id\//i.test(url)) {
    if (userHasFeatureKeys(req, "invoice") && hasFeatureScope(req, "invoice", "partner")) {
      return { feature: "invoice", scope: "partner" };
    }
    if (userHasFeatureKeys(req, "orders") && hasFeatureScope(req, "orders", "partner")) {
      return { feature: "orders", scope: "partner" };
    }
  }

  if (/\/customer-list\/(not-assigned|not-assign|all)(?:\/|$)/i.test(url)) {
    if (
      userHasFeatureKeys(req, "invoice") &&
      hasFeatureScope(req, "invoice", "customer") &&
      !hasPermissionKey(req, "customer_view")
    ) {
      return { feature: "invoice", scope: "customer" };
    }
    if (
      userHasFeatureKeys(req, "orders") &&
      hasFeatureScope(req, "orders", "customer") &&
      !hasPermissionKey(req, "customer_view")
    ) {
      return { feature: "orders", scope: "customer" };
    }
  }

  if (/\/admin\/product\/?$/i.test(url)) {
    if (
      userHasFeatureKeys(req, "invoice") &&
      hasFeatureScope(req, "invoice", "customer") &&
      !hasPermissionKey(req, "product_view")
    ) {
      return { feature: "invoice", scope: "customer" };
    }
    if (
      userHasFeatureKeys(req, "orders") &&
      hasFeatureScope(req, "orders", "customer") &&
      !hasPermissionKey(req, "product_view")
    ) {
      return { feature: "orders", scope: "customer" };
    }
  }

  if (/\/admin\/sales-rep\/?$/i.test(url)) {
    if (
      userHasFeatureKeys(req, "invoice") &&
      !hasPermissionKey(req, "local-partner_view")
    ) {
      return { feature: "invoice", scope: "partner" };
    }
    if (
      userHasFeatureKeys(req, "orders") &&
      !hasPermissionKey(req, "local-partner_view")
    ) {
      return { feature: "orders", scope: "partner" };
    }
  }

  return null;
};

const resolveDomainRule = (url) => {
  for (const rule of DOMAIN_RULES) {
    if (rule.test.test(url)) return rule;
  }
  return undefined;
};

const domainsFromRule = (rule) => {
  if (!rule) return undefined;
  if (rule.domain === null) return null;
  if (Array.isArray(rule.domains) && rule.domains.length > 0) return rule.domains;
  if (rule.domain !== undefined) return [rule.domain];
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

  const rawUrl = `${req.originalUrl || req.url || ""}`;
  const url = rawUrl.split("?")[0];
  if (SKIP_PATHS.some((re) => re.test(url))) return next();
  if (SELF_PROFILE_PATHS.some((re) => re.test(url))) return next();

  const domains = domainsFromRule(resolveDomainRule(url));
  if (domains === null) {
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
  if (domains === undefined) {
    return deny(next, "This admin action is not available to sub-admins");
  }

  let effectiveDomains = domains;
  if (urlIndicatesInvoiceList(rawUrl)) {
    effectiveDomains = [...effectiveDomains, "invoice"];
  }

  const isPartnerWorkPath =
    /\/admin\/sales-rep\/?$/i.test(url) ||
    /\/customer-list\/sale-rep-id\//i.test(rawUrl) ||
    /\/products\/sales-rep/i.test(url);
  if (isPartnerWorkPath) {
    if (userHasFeatureKeys(req, "invoice") && hasFeatureScope(req, "invoice", "partner")) {
      effectiveDomains = [...effectiveDomains, "invoice"];
    }
    if (userHasFeatureKeys(req, "orders") && hasFeatureScope(req, "orders", "partner")) {
      effectiveDomains = [...effectiveDomains, "orders"];
    }
  }

  const isAdminCustomerWorkPath =
    /\/customer-list\/(not-assigned|not-assign|all)(?:\/|$)/i.test(url) ||
    /\/admin\/product\/?$/i.test(url) ||
    (/invoice-customers-balance/i.test(url) &&
      !/\/sales-rep\//i.test(url) &&
      !/[?&]owner=partner(?:&|$)/i.test(rawUrl));
  if (isAdminCustomerWorkPath) {
    if (userHasFeatureKeys(req, "invoice") && hasFeatureScope(req, "invoice", "customer")) {
      effectiveDomains = [...effectiveDomains, "invoice"];
    }
    if (userHasFeatureKeys(req, "orders") && hasFeatureScope(req, "orders", "customer")) {
      effectiveDomains = [...effectiveDomains, "orders"];
    }
  }

  const isPartnerBalancePath =
    /invoice-customers-balance/i.test(url) &&
    (/\/sales-rep\//i.test(url) || /[?&]owner=partner(?:&|$)/i.test(rawUrl));
  if (isPartnerBalancePath) {
    if (userHasFeatureKeys(req, "invoice") && hasFeatureScope(req, "invoice", "partner")) {
      effectiveDomains = [...effectiveDomains, "invoice"];
    }
    if (userHasFeatureKeys(req, "orders") && hasFeatureScope(req, "orders", "partner")) {
      effectiveDomains = [...effectiveDomains, "orders"];
    }
  }
  if (/\/book-new/i.test(url) && userHasFeatureKeys(req, "invoice")) {
    effectiveDomains = [...effectiveDomains, "invoice"];
  }

  const action = resolveAction(req.method, url);
  const allowed = effectiveDomains.some((domain) =>
    hasPermissionKey(req, `${domain}_${action}`),
  );
  if (!allowed) {
    const key = `${effectiveDomains[0]}_${action}`;
    if (
      action !== "view" &&
      effectiveDomains.every((domain) => hasPermissionKey(req, `${domain}_view`) === false)
    ) {
      return deny(next);
    }
    return deny(next, `Missing permission ${key}`);
  }

  const requiredScope = resolveRequiredScope(req, rawUrl);
  if (
    requiredScope &&
    !hasFeatureScope(req, requiredScope.feature, requiredScope.scope)
  ) {
    return deny(
      next,
      `This ${requiredScope.scope === "partner" ? "Local Partner" : "Customer"} data is outside your access scope`,
    );
  }
  return next();
};
