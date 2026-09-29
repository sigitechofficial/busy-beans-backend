/**
 * Customer details access (Phase 16): who may see identified customers (name, company, email,
 * phone, customer journeys) in the Campaign Builder, masking for everyone else, and an audit
 * log of every request that returned identified customers.
 *
 *   Permission  Super Admin always; other roles only when listed in MARKETING_CUSTOMER_PII_ROLES
 *               (comma-separated role names, case-insensitive; default none). The role is read from
 *               the database on every request, so a role change takes effect immediately.
 *   Masking     done on the server: callers without permission never receive the details.
 *   Audit       marketing_pii_access_log (migration 032), kept MARKETING_PII_LOG_RETENTION_DAYS
 *               (default 730), purged by the marketing scheduler.
 */
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getMarketingUserModel } = require("../models/marketingUser");
const { toSqlUtc } = require("../utils/dateRange");
const { clientIp, anonymizeIp } = require("../utils/requestMeta");

const SUPER_ADMIN = "super admin";

function piiRoles() {
  return String(process.env.MARKETING_CUSTOMER_PII_ROLES || "")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

function roleCanViewCustomerDetails(role) {
  const r = String(role || "").trim().toLowerCase();
  return r === SUPER_ADMIN || (r !== "" && piiRoles().includes(r));
}

/** The requesting marketing user as stored now (id, email, role) + permission. */
async function resolveAccess(req) {
  const token = req.marketingUser || {};
  let user = null;
  if (token.sub) {
    user = await getMarketingUserModel().findByPk(token.sub, { attributes: ["id", "email", "role"] }).catch(() => null);
  }
  const role = user?.role ?? token.role ?? "";
  return {
    userId: user?.id ?? token.sub ?? null,
    email: user?.email ?? token.email ?? null,
    role,
    canViewCustomerDetails: roleCanViewCustomerDetails(role),
    ip: anonymizeIp(clientIp(req)),
    userAgent: typeof req.get === "function" ? req.get("user-agent") : null,
  };
}

/** Customer as shown to callers without permission. */
function maskedCustomer(customerUserId) {
  return {
    customerUserId: String(customerUserId),
    name: `Customer #${customerUserId}`,
    email: null,
    company: null,
    phone: null,
    masked: true,
  };
}

/** Customer card for the caller: details when permitted, masked otherwise. */
function presentCustomer(access, customerUserId, directory) {
  if (!customerUserId) return null;
  if (!access?.canViewCustomerDetails) return maskedCustomer(customerUserId);
  const c = directory?.get(String(customerUserId));
  return {
    customerUserId: String(customerUserId),
    name: c?.name || `Customer #${customerUserId}`,
    email: c?.email || null,
    company: c?.company || null,
    phone: c?.phone || null,
    masked: false,
  };
}

/** One audit row when identified customers were returned (no-op otherwise). */
async function logPiiAccess(access, { action, subject, customerIds }) {
  if (!access?.canViewCustomerDetails) return false;
  const ids = [...new Set((customerIds || []).filter(Boolean).map(String))].slice(0, 100);
  if (!ids.length) return false;
  await getMarketingSequelize().query(
    `INSERT INTO marketing_pii_access_log
       (marketing_user_id, email, role, action, subject, customer_ids, ip_anonymized, user_agent, created_at)
     VALUES (:userId, :email, :role, :action, :subject, :customerIds, :ip, :userAgent, :createdAt)`,
    {
      replacements: {
        userId: access.userId ? String(access.userId).slice(0, 64) : null,
        email: access.email ? String(access.email).slice(0, 255) : null,
        role: access.role ? String(access.role).slice(0, 64) : null,
        action: String(action).slice(0, 32),
        subject: subject ? String(subject).slice(0, 128) : null,
        customerIds: JSON.stringify(ids),
        ip: access.ip || null,
        userAgent: access.userAgent ? String(access.userAgent).slice(0, 300) : null,
        createdAt: toSqlUtc(new Date()),
      },
      type: QueryTypes.INSERT,
    },
  );
  return true;
}

/** Recent audit rows, optionally for one marketing user or one customer id. */
async function listPiiAccess({ userId, customerId, limit = 100 } = {}) {
  const where = [];
  const replacements = { limit: Math.min(Math.max(Number(limit) || 100, 1), 500) };
  if (userId) {
    where.push("marketing_user_id = :userId");
    replacements.userId = String(userId);
  }
  if (customerId) {
    where.push("JSON_CONTAINS(customer_ids, JSON_QUOTE(:customerId))");
    replacements.customerId = String(customerId);
  }
  const rows = await getMarketingSequelize().query(
    `SELECT id, marketing_user_id AS userId, email, role, action, subject, customer_ids AS customerIds,
            ip_anonymized AS ipAnonymized, created_at AS createdAt
     FROM marketing_pii_access_log ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC, id DESC LIMIT :limit`,
    { replacements, type: QueryTypes.SELECT },
  );
  return rows.map((r) => ({
    ...r,
    customerIds: typeof r.customerIds === "string" ? JSON.parse(r.customerIds) : r.customerIds || [],
  }));
}

function retentionDays() {
  const days = Number(process.env.MARKETING_PII_LOG_RETENTION_DAYS || 730);
  return Number.isFinite(days) && days >= 30 ? Math.floor(days) : 730;
}

async function purgeOldPiiAccess(now = new Date()) {
  const cutoff = new Date(now.getTime() - retentionDays() * 24 * 60 * 60 * 1000);
  const [result] = await getMarketingSequelize().query(
    "DELETE FROM marketing_pii_access_log WHERE created_at < :cutoff LIMIT 5000",
    { replacements: { cutoff: toSqlUtc(cutoff) } },
  );
  return Number(result?.affectedRows) || 0;
}

module.exports = {
  roleCanViewCustomerDetails,
  resolveAccess,
  maskedCustomer,
  presentCustomer,
  logPiiAccess,
  listPiiAccess,
  purgeOldPiiAccess,
  retentionDays,
};
