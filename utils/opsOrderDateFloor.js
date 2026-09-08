const { Op } = require("sequelize");

function opsOrderMinDate() {
  return process.env.OPS_ORDER_MIN_DATE || "2026-01-01";
}

function toDateOnly(value) {
  if (value == null) return null;
  return String(value).slice(0, 10);
}

function laterDate(a, b) {
  const left = toDateOnly(a);
  const right = toDateOnly(b);
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}

function clampOpsOnQuery(query) {
  if (!query) return;
  const min = opsOrderMinDate();
  const on = query.on;

  if (on && typeof on === "object") {
    const current = on.gte || on.gt;
    on.gte = laterDate(current, min);
    return;
  }

  if (typeof on === "string") {
    if (toDateOnly(on) < min) query.on = { gte: min };
    return;
  }

  query.on = { gte: min };
}

function mergeOpsOnWhere(where = {}) {
  const min = opsOrderMinDate();
  const next = { ...where };
  const existing = next.on;

  if (existing && typeof existing === "object") {
    const currentGte = existing[Op.gte] ?? existing.gte;
    next.on = {
      ...existing,
      [Op.gte]: laterDate(currentGte, min),
    };
  } else if (typeof existing === "string") {
    if (toDateOnly(existing) < min) next.on = { [Op.gte]: min };
  } else {
    next.on = { [Op.gte]: min };
  }

  return next;
}

function applyOpsOrderDateFloor(req, condition) {
  clampOpsOnQuery(req?.query);
  if (!condition) return;
  condition.on = mergeOpsOnWhere({ on: condition.on }).on;
}

function opsOrderOnSql(tableName = "orders") {
  const table = String(tableName).replace(/[^a-zA-Z0-9_]/g, "") || "orders";
  return `AND ${table}.\`on\` >= '${opsOrderMinDate()}'`;
}

module.exports = {
  opsOrderMinDate,
  clampOpsOnQuery,
  mergeOpsOnWhere,
  applyOpsOrderDateFloor,
  opsOrderOnSql,
};
