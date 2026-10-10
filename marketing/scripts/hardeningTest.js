/**
 * Phase 11 hardening checks. Unit-level (no server) plus a few HTTP checks against the local
 * API (MARKETING_TEST_BASE_URL, default http://localhost:8013). Writes no data.
 *   node marketing/scripts/hardeningTest.js
 */
require("dotenv").config();
const errorHandler = require("../../controllers/errorController");
const AppError = require("../../utils/appError");
const { corsOptions, readCorsConfig } = require("../../middlewares/corsOriginAudit");
const { isBotUserAgent, anonymizeIp, leadIpForStorage } = require("../utils/requestMeta");

const BASE = (process.env.MARKETING_TEST_BASE_URL || "http://localhost:8013").replace(/\/api\/?$/, "").replace(/\/+$/, "");
let failures = 0;
function check(condition, label) {
  if (!condition) failures += 1;
  // eslint-disable-next-line no-console
  console.log(`${condition ? "ok  " : "FAIL"} ${label}`);
}

function fakeRes() {
  const res = { statusCode: 0, body: undefined, headersSent: false, headers: {} };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    res.headersSent = true;
    return res;
  };
  res.type = () => res;
  res.send = (body) => {
    res.body = body;
    res.headersSent = true;
    return res;
  };
  return res;
}

function runHandler(err, url = "/api/x", env = {}) {
  const saved = { NODE_ENV: process.env.NODE_ENV, API_ERROR_DETAILS: process.env.API_ERROR_DETAILS };
  Object.assign(process.env, env);
  if (!("API_ERROR_DETAILS" in env)) delete process.env.API_ERROR_DETAILS;
  const res = fakeRes();
  const log = console.error;
  console.error = () => {};
  try {
    errorHandler(err, { originalUrl: url }, res, () => {});
  } finally {
    console.error = log;
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
  return res;
}

async function run() {
  // Error handler
  const bug = new Error("SELECT * FROM secrets WHERE id = 1 failed");
  for (const nodeEnv of ["development", "production", "staging", ""]) {
    const res = runHandler(bug, "/api/x", { NODE_ENV: nodeEnv });
    check(res.statusCode === 500 && !JSON.stringify(res.body).includes("secrets"), `unknown error, NODE_ENV="${nodeEnv}" → generic 500`);
  }
  check(runHandler(new AppError("Not found here", 404)).body?.message === "Not found here", "operational error message kept");
  const parseErr = Object.assign(new SyntaxError("Unexpected token"), { type: "entity.parse.failed", status: 400, statusCode: 400 });
  check(runHandler(parseErr).statusCode === 400, "malformed JSON → 400");
  const fk = Object.assign(new Error("Cannot add or update a child row: a foreign key constraint fails (`db`.`orders`)"), { name: "SequelizeForeignKeyConstraintError" });
  const fkRes = runHandler(fk);
  check(fkRes.statusCode === 400 && !JSON.stringify(fkRes.body).includes("orders"), "FK error → 400 without SQL detail");
  const detailed = runHandler(bug, "/api/x", { API_ERROR_DETAILS: "true" });
  check(Boolean(detailed.body?.stack), "API_ERROR_DETAILS=true shows the stack (opt-in)");
  const page = runHandler(bug, "/view/pay-order-invoice", { NODE_ENV: "production" });
  check(page.statusCode === 500 && typeof page.body === "string" && !page.body.includes("secrets"), "non-API error → plain generic text (no missing view)");

  // CORS
  const env = { CORS_ALLOWED_ORIGINS: "https://www.busybeancoffee.com, https://*.busybeancoffee.com/", CORS_ENFORCE: "true" };
  const log = console.log;
  console.log = () => {};
  const enforced = corsOptions(env);
  const reflect = corsOptions({ CORS_ALLOWED_ORIGINS: env.CORS_ALLOWED_ORIGINS });
  console.log = log;
  const decide = (opts, origin) => new Promise((resolve) => opts.origin(origin, (_e, allow) => resolve(allow)));
  check((await decide(enforced, "https://www.busybeancoffee.com")) === true, "enforce: listed origin allowed");
  check((await decide(enforced, "https://admin.busybeancoffee.com")) === true, "enforce: *.busybeancoffee.com wildcard");
  check((await decide(enforced, "https://evil.com")) === false, "enforce: unlisted origin refused");
  check((await decide(enforced, "https://busybeancoffee.com.evil.com")) === false, "enforce: suffix trick refused");
  check((await decide(enforced, "https://a.b.busybeancoffee.com")) === false, "enforce: wildcard is one level only");
  check((await decide(enforced, undefined)) === true, "enforce: no Origin (server/mobile) allowed");
  check((await decide(reflect, "https://evil.com")) === true, "without CORS_ENFORCE: unchanged (reflect)");
  check(readCorsConfig({ CORS_ENFORCE: "true" }).enforce === false, "CORS_ENFORCE with an empty list does not lock everyone out");

  // Bots / IPs
  for (const ua of ["Googlebot/2.1 (+http://www.google.com/bot.html)", "Mozilla/5.0 (compatible; bingbot/2.0)", "facebookexternalhit/1.1", "Mozilla/5.0 HeadlessChrome/120", "curl/8.4.0", "python-requests/2.31", ""]) {
    check(isBotUserAgent(ua), `bot: "${ua.slice(0, 40)}"`);
  }
  for (const ua of [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0",
  ]) {
    check(!isBotUserAgent(ua), `browser: ${ua.slice(13, 45)}`);
  }
  check(anonymizeIp("203.0.113.77") === "203.0.113.0", "IPv4 anonymized to /24");
  check(anonymizeIp("2001:db8:85a3::8a2e:370:7334") === "2001:db8:85a3::", "IPv6 anonymized to /48");
  check(leadIpForStorage("203.0.113.77", "off") === null && leadIpForStorage("203.0.113.77", "full") === "203.0.113.77", "IP modes off/full");

  // Lead email escaping (module-private function: check via source contract)
  const src = require("fs").readFileSync(require.resolve("../services/leadSubmissions.service"), "utf8");
  check(/escapeHtml\(value\)/.test(src) && /escapeHtml\(pageUrl\)/.test(src), "lead email escapes field values and page URL");

  // HTTP
  try {
    const bad = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json" });
    check(bad.status === 400, `malformed JSON over HTTP → ${bad.status}`);
    const res = await fetch(`${BASE}/api/public/landing-pages/test-page`);
    check(res.headers.get("x-content-type-options") === "nosniff", "helmet: nosniff");
    check(Boolean(res.headers.get("strict-transport-security")), "helmet: HSTS");
    check(!res.headers.get("x-powered-by"), "helmet: X-Powered-By removed");
    const bot = await fetch(`${BASE}/api/public/tracking/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Googlebot/2.1" },
      body: JSON.stringify({ id: "should-not-store", visitorId: "v", sessionId: "s", eventType: "page_view" }),
    });
    check(bot.status === 204, `bot tracking dropped → ${bot.status}`);
  } catch (error) {
    check(false, `HTTP checks (is the API running at ${BASE}?): ${error.message}`);
  }

  if (failures) throw new Error(`${failures} check(s) failed`);
  // eslint-disable-next-line no-console
  console.log("[hardening] passed");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[hardening] failed:", error.message);
    process.exit(1);
  });
