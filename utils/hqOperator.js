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
  getHqAccountId,
};
