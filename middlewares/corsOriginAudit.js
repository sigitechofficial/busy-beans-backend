/**
 * CORS policy for the API.
 *
 * CORS_ALLOWED_ORIGINS — comma-separated browser origins that may call the API with
 *   credentials, e.g. https://www.busybeancoffee.com,https://admin.busybeancoffee.com.
 *   A leading "*." wildcard matches one subdomain level: https://*.busybeancoffee.com.
 * CORS_ENFORCE=true    — only listed origins get CORS headers (others are refused by the
 *   browser). Without it the API keeps reflecting any origin (the historical behavior) and
 *   only LOGS origins that are not on the list, so the list can be completed from real
 *   traffic before switching enforcement on.
 * Requests without an Origin header (server-to-server, mobile apps, curl) are unaffected.
 * Each unlisted origin is logged once per process.
 */
const seenOrigins = new Set();

function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/+$/, "").toLowerCase();
}

function parseAllowedOrigins(raw) {
  return new Set(
    String(raw || "")
      .split(",")
      .map(normalizeOrigin)
      .filter(Boolean),
  );
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Exact origins plus "*." wildcard patterns → matcher. */
function buildOriginMatcher(allowed) {
  const exact = new Set();
  const patterns = [];
  for (const entry of allowed) {
    if (entry.includes("*.")) {
      patterns.push(new RegExp(`^${escapeRegex(entry).replace("\\*\\.", "[a-z0-9-]+\\.")}$`));
    } else {
      exact.add(entry);
    }
  }
  return (origin) => exact.has(origin) || patterns.some((re) => re.test(origin));
}

function readCorsConfig(env = process.env) {
  const allowed = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
  return {
    allowed,
    isAllowed: buildOriginMatcher(allowed),
    enforce: env.CORS_ENFORCE === "true" && allowed.size > 0,
  };
}

function logOnce(origin, message) {
  if (seenOrigins.has(origin)) return;
  seenOrigins.add(origin);
  // eslint-disable-next-line no-console
  console.warn(message);
}

/** Log-only audit (kept for the inventory log line; the policy itself is corsOptions()). */
function corsOriginAudit(env = process.env) {
  const { allowed, isAllowed, enforce } = readCorsConfig(env);
  const inventoryMode = allowed.size === 0;
  return (req, _res, next) => {
    const origin = normalizeOrigin(req.headers.origin);
    if (origin && !isAllowed(origin)) {
      const state = inventoryMode ? "origin seen" : enforce ? "origin BLOCKED (not in CORS_ALLOWED_ORIGINS)" : "origin NOT in CORS_ALLOWED_ORIGINS";
      logOnce(origin, `[cors-audit] ${state}: ${origin} (first request: ${req.method} ${req.originalUrl.split("?")[0]})`);
    }
    next();
  };
}

/** Options for the `cors` package. */
function corsOptions(env = process.env) {
  const { isAllowed, enforce } = readCorsConfig(env);
  // eslint-disable-next-line no-console
  console.log(
    enforce
      ? "[cors] enforcing CORS_ALLOWED_ORIGINS"
      : "[cors] reflecting any origin (set CORS_ALLOWED_ORIGINS and CORS_ENFORCE=true to restrict)",
  );
  return {
    origin: (origin, callback) => {
      if (!origin || !enforce) return callback(null, true);
      return callback(null, isAllowed(normalizeOrigin(origin)));
    },
    credentials: true,
    maxAge: 600,
  };
}

module.exports = { corsOriginAudit, corsOptions, parseAllowedOrigins, readCorsConfig, buildOriginMatcher };
