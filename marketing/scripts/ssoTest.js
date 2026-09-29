/**
 * Admin → Campaign Builder SSO checks (Phase 10). Local only: needs the API running
 * (MARKETING_TEST_BASE_URL, default http://localhost:8013) and at least one marketing user.
 * Issues codes through the service (the commerce issue route needs a Redis-backed admin
 * session), exchanges them over HTTP, and removes the audit rows it created.
 *   node marketing/scripts/ssoTest.js
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { issueCode } = require("../services/sso.service");

const BASE = (process.env.MARKETING_TEST_BASE_URL || "http://localhost:8013").replace(/\/api\/?$/, "").replace(/\/+$/, "");
let failures = 0;
function check(condition, label) {
  if (!condition) failures += 1;
  // eslint-disable-next-line no-console
  console.log(`${condition ? "ok  " : "FAIL"} ${label}`);
}

async function exchange(code) {
  const res = await fetch(`${BASE}/api/auth/sso/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function me(token) {
  const res = await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  return res.status;
}

async function run() {
  const db = getMarketingSequelize();
  const [user] = await db.query("SELECT id, email FROM marketing_users ORDER BY created_at LIMIT 1", { type: QueryTypes.SELECT });
  if (!user) throw new Error("No marketing user to test with.");
  const testAdminId = 900000000 + (Date.now() % 1000000);
  const unknownEmail = `sso-test-${Date.now()}@example.invalid`;

  try {
    const { code, expiresIn } = await issueCode({ adminEntity: "admin", adminId: testAdminId, email: user.email.toUpperCase(), ip: "127.0.0.1" });
    check(code.length >= 40 && expiresIn === 60, "code issued (256-bit, 60 s)");
    const [stored] = await db.query("SELECT code_hash FROM marketing_sso_codes WHERE admin_id = ? ORDER BY id DESC LIMIT 1", {
      replacements: [testAdminId],
      type: QueryTypes.SELECT,
    });
    check(stored && stored.code_hash !== code && stored.code_hash.length === 64, "only the SHA-256 is stored");

    const first = await exchange(code);
    check(first.status === 200 && Boolean(first.body?.data?.token), `exchange → ${first.status}`);
    check(first.body?.data?.user?.id === user.id, "session is for the marketing user with that email (case-insensitive)");
    check((await me(first.body?.data?.token)) === 200, "issued token works on /auth/me");

    const replay = await exchange(code);
    check(replay.status === 401 && replay.body?.code === "SSO_INVALID_CODE", `replayed code → ${replay.status}`);

    const expired = await issueCode({ adminEntity: "admin", adminId: testAdminId, email: user.email, ip: null });
    await db.query("UPDATE marketing_sso_codes SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE admin_id = ? AND used_at IS NULL", {
      replacements: [testAdminId],
    });
    check((await exchange(expired.code)).status === 401, "expired code → 401");

    check((await exchange("x".repeat(43))).status === 401, "guessed code → 401");
    check((await exchange("")).status === 401, "empty code → 401");

    const noAccount = await issueCode({ adminEntity: "admin", adminId: testAdminId, email: unknownEmail, ip: null });
    const denied = await exchange(noAccount.code);
    check(denied.status === 403 && denied.body?.code === "SSO_NO_ACCOUNT", `admin without a builder account → ${denied.status}`);

    const outcomes = await db.query("SELECT outcome FROM marketing_sso_codes WHERE admin_id = ? ORDER BY id", {
      replacements: [testAdminId],
      type: QueryTypes.SELECT,
    });
    check(outcomes.map((o) => o.outcome).join(",") === "ok,,no_marketing_user", `audit outcomes: ${outcomes.map((o) => o.outcome).join(",")}`);

    // A token without scope "marketing" (commerce-style) must be refused even with a valid signature.
    const secret = process.env.MARKETING_JWT_SECRET || process.env.JWT_SECRET;
    const scopeless = jwt.sign({ id: 1, sub: user.id, email: user.email, entity: "admin" }, secret, { expiresIn: "5m" });
    check((await me(scopeless)) === 401, "scope-less token rejected by marketing auth");

    const issueNoAuth = await fetch(`${BASE}/api/v1/admin/marketing-sso/code`, { method: "POST" });
    check(issueNoAuth.status === 401, `issue route without admin session → ${issueNoAuth.status}`);
  } finally {
    await db.query("DELETE FROM marketing_sso_codes WHERE admin_id = ?", { replacements: [testAdminId] });
  }

  if (failures) throw new Error(`${failures} check(s) failed`);
  // eslint-disable-next-line no-console
  console.log("[sso] passed");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[sso] failed:", error.message);
    process.exit(1);
  });
