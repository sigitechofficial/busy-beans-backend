/**
 * Express "trust proxy" from TRUST_PROXY_HOPS.
 *   unset / ""      1 (one reverse proxy — nginx on the API server)
 *   "0"             trust nothing (API reached directly)
 *   "2"             two hops (e.g. load balancer → nginx → node)
 *   other strings   passed to Express as is ("loopback", "10.0.0.0/8, loopback", …)
 * Never `true`: that trusts any X-Forwarded-For value a client sends.
 */
function trustProxySetting(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return 1;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "true") return 1;
  return value;
}

module.exports = { trustProxySetting };
