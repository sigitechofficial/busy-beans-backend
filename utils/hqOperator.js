const isHqOperator = (entity) => entity === "admin" || entity === "subAdmin";

const isHqStaff = (entity) =>
  isHqOperator(entity) || entity === "adminEmployee";

const getPermissionKeys = (user) => {
  if (!user) return [];
  if (Array.isArray(user.permissionKeys)) return user.permissionKeys;
  if (Array.isArray(user.permissions)) {
    return user.permissions.map((p) => p.key).filter(Boolean);
  }
  return [];
};

const hasPermissionKey = (req, key) => {
  if (!req?.user) return false;
  if (req.user.entity === "admin") return true;
  return getPermissionKeys(req.user).includes(key);
};

const SCOPED_FEATURES = [
  "orders",
  "quickbooks-invoices",
  "invoice",
  "subscription",
  "report",
];

const FEATURE_ACTIONS = ["view", "create", "update", "delete"];

const isScopedFeature = (feature) => SCOPED_FEATURES.includes(feature);

const userHasFeatureKeys = (req, feature) =>
  getPermissionKeys(req?.user).some(
    (key) =>
      key === `${feature}_scope_customer` ||
      key === `${feature}_scope_partner` ||
      FEATURE_ACTIONS.some((action) => key === `${feature}_${action}`),
  );

/**
 * Sub-admin Customer vs Local Partner scope.
 * Legacy: any CRUD key and no scope keys → both scopes (do not lock existing accounts).
 * HQ admin and employees are unrestricted.
 */
const hasFeatureScope = (req, feature, scope) => {
  if (!req?.user) return false;
  if (req.user.entity === "admin") return true;
  if (req.user.entity !== "subAdmin") return true;
  if (!isScopedFeature(feature)) return true;

  const keys = getPermissionKeys(req.user);
  const hasCustomer = keys.includes(`${feature}_scope_customer`);
  const hasPartner = keys.includes(`${feature}_scope_partner`);
  if (!hasCustomer && !hasPartner) {
    return FEATURE_ACTIONS.some((action) => keys.includes(`${feature}_${action}`));
  }
  return scope === "partner" ? hasPartner : hasCustomer;
};

let cachedHqAccountId = null;

const getHqAccountId = async () => {
  if (cachedHqAccountId) return cachedHqAccountId;
  const { account } = require("../models");
  const hq = await account.findOne({
    where: { deleted: 0 },
    attributes: ["id"],
    order: [["id", "ASC"]],
  });
  if (!hq) {
    const err = new Error("HQ admin account was not found.");
    err.statusCode = 500;
    throw err;
  }
  cachedHqAccountId = hq.id;
  return cachedHqAccountId;
};

module.exports = {
  isHqOperator,
  isHqStaff,
  getPermissionKeys,
  hasPermissionKey,
  hasFeatureScope,
  userHasFeatureKeys,
  isScopedFeature,
  SCOPED_FEATURES,
  FEATURE_ACTIONS,
  getHqAccountId,
};
