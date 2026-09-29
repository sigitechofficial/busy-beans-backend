/**
 * Admin panel → Campaign Builder single sign-on (Phase 10).
 *
 *  issueCode    — called by a signed-in commerce admin (POST /api/v1/admin/marketing-sso/code).
 *                 Returns a random single-use code valid for 60 s; only its SHA-256 is stored.
 *  exchangeCode — called by the Campaign Builder's /admin/sso page (POST /api/auth/sso/exchange).
 *                 Burns the code atomically and returns a marketing session for the marketing
 *                 user with the same email. No account is created unless
 *                 MARKETING_SSO_AUTO_CREATE=true (then with MARKETING_SSO_DEFAULT_ROLE, default
 *                 "Editor" — never Super Admin).
 * Every issue/exchange is recorded on the code row and logged.
 */
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getMarketingUserModel } = require("../models/marketingUser");
const { formatUserResponse, signMarketingToken } = require("./auth.service");

const CODE_TTL_SECONDS = 60;
const AUDIT_RETENTION_DAYS = 90;

function ssoError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function clip(value, max) {
  return value ? String(value).slice(0, max) : null;
}

async function issueCode({ adminEntity, adminId, email, ip }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !adminId) throw ssoError("Admin account has no email.", "SSO_NO_EMAIL", 400);
  const db = getMarketingSequelize();
  const code = crypto.randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO marketing_sso_codes (code_hash, admin_entity, admin_id, admin_email, issued_ip, expires_at)
     VALUES (:hash, :entity, :adminId, :email, :ip, UTC_TIMESTAMP() + INTERVAL ${CODE_TTL_SECONDS} SECOND)`,
    {
      replacements: { hash: hashCode(code), entity: adminEntity, adminId, email: normalizedEmail, ip: clip(ip, 64) },
    },
  );
  await db.query(
    `DELETE FROM marketing_sso_codes WHERE created_at < UTC_TIMESTAMP() - INTERVAL ${AUDIT_RETENTION_DAYS} DAY`,
  );
  // eslint-disable-next-line no-console
  console.log(`[marketing:sso] code issued admin=${adminEntity}:${adminId} email=${normalizedEmail}`);
  return { code, expiresIn: CODE_TTL_SECONDS };
}

async function findOrCreateMarketingUser(email) {
  const MarketingUser = getMarketingUserModel();
  const existing = await MarketingUser.findOne({ where: { email } });
  if (existing) return existing;
  if (process.env.MARKETING_SSO_AUTO_CREATE !== "true") return null;
  const role = (process.env.MARKETING_SSO_DEFAULT_ROLE || "Editor").trim();
  return MarketingUser.create({
    id: `mu-sso-${crypto.randomBytes(8).toString("hex")}`,
    email,
    name: email.split("@")[0],
    role: role.toLowerCase() === "super admin" ? "Editor" : role,
    // Unusable password: these users sign in through the admin panel.
    password_hash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
  });
}

async function exchangeCode({ code, ip, userAgent }) {
  const raw = String(code || "");
  if (raw.length < 20 || raw.length > 100) {
    throw ssoError("Invalid or expired sign-in link.", "SSO_INVALID_CODE", 401);
  }
  const db = getMarketingSequelize();
  const hash = hashCode(raw);
  const [, affected] = await db.query(
    `UPDATE marketing_sso_codes SET used_at = UTC_TIMESTAMP(), used_ip = :ip, used_user_agent = :ua
     WHERE code_hash = :hash AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
    { replacements: { hash, ip: clip(ip, 64), ua: clip(userAgent, 300) }, type: QueryTypes.UPDATE },
  );
  if (!affected) {
    // eslint-disable-next-line no-console
    console.warn("[marketing:sso] rejected code (unknown, used or expired)");
    throw ssoError(
      "Invalid or expired sign-in link. Open the Campaign Builder from the admin panel again.",
      "SSO_INVALID_CODE",
      401,
    );
  }
  const [row] = await db.query(
    "SELECT id, admin_entity, admin_id, admin_email FROM marketing_sso_codes WHERE code_hash = :hash",
    { replacements: { hash }, type: QueryTypes.SELECT },
  );
  const setOutcome = (outcome, marketingUserId = null) =>
    db.query("UPDATE marketing_sso_codes SET outcome = :outcome, marketing_user_id = :uid WHERE id = :id", {
      replacements: { outcome, uid: marketingUserId, id: row.id },
    });

  const user = await findOrCreateMarketingUser(row.admin_email);
  if (!user) {
    await setOutcome("no_marketing_user");
    // eslint-disable-next-line no-console
    console.warn(`[marketing:sso] no Campaign Builder account for ${row.admin_email}`);
    throw ssoError(
      "Your admin account has no Campaign Builder access. Ask a Super Admin to add your email.",
      "SSO_NO_ACCOUNT",
      403,
    );
  }
  await setOutcome("ok", user.id);
  // eslint-disable-next-line no-console
  console.log(`[marketing:sso] signed in marketing user=${user.id} via admin=${row.admin_entity}:${row.admin_id}`);
  return { token: signMarketingToken(user), user: formatUserResponse(user) };
}

module.exports = { issueCode, exchangeCode, hashCode, CODE_TTL_SECONDS };
