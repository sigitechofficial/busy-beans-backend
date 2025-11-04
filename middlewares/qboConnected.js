// middleware/qboConnected.js
// Ensures QBO is connected and tokens are actually usable (live check with TTL)
const { qboToken } = require('../models');
const QBO = require('../controllers/quickBooks');

// How long to cache a successful health probe (ms). Tune as needed.
const HEALTH_TTL_MS = Number(process.env.QBO_HEALTH_TTL_MS || 60_000);

// Optional: allow skipping health probe for specific requests (e.g., internal health)
// Send header: x-qbo-health-skip: 1
const SKIP_HEADER = 'x-qbo-health-skip';

// In-process cache to avoid hitting Intuit for every request
let healthCache = {
  ts: 0,
  ok: false,
  realmId: null,
};

// De-dupe concurrent probes (avoid thundering herd)
let ongoingProbe = null;

module.exports = async (req, res, next) => {
  try {
    // 1) DB presence check
    const row = await qboToken.findOne();
    if (!row) {
      return res.status(400).json({
        status: 'auth-require',
        message: 'QuickBooks not connected. Visit /qbo/auth/login first.',
        reconnectUrlEndpoint: '/qbo/auth/login',
      });
    }

    // 2) Optionally skip live probe via header
    if (req.headers[SKIP_HEADER] === '1') {
      return next();
    }

    const now = Date.now();

    // 3) TTL cache hit?
    if (
      healthCache.ok &&
      healthCache.realmId === row.realmId &&
      now - healthCache.ts < HEALTH_TTL_MS
    ) {
      return next();
    }

    // 4) Run (or join) a live probe: minimal GET to verify tokens
    if (!ongoingProbe) {
      ongoingProbe = (async () => {
        try {
          // getCompanyInfo() uses qboGet() under the hood and will:
          // - auto-refresh access token
          // - detect 3200 "Token revoked", clear tokens, and throw a typed error
          await QBO.getCompanyInfo();

          // Success → refresh cache
          healthCache = { ts: Date.now(), ok: true, realmId: row.realmId };
        } finally {
          ongoingProbe = null;
        }
      })();
    }

    // wait for the probe result
    await ongoingProbe;

    // If we got here without throwing, health is OK
    return next();
  } catch (e) {
    console.log('🚀 ~ err:', e);
    const wa = (e?.response?.headers?.['www-authenticate'] || '') + '';
    const isHeaderRevoked = /invalid_token|token revoked/i.test(wa);

    if (e?.code === 'QBO_TOKEN_REVOKED' || isHeaderRevoked) {
      return res.status(428).json({
        status: 'auth-require',
        error: 'qbo_token_revoked',
        message: 'QuickBooks connection was revoked. Please connect again.',
        reconnectUrlEndpoint: '/qbo/auth/login',
      });
    }

    return res.status(503).json({
      status: 'error',
      error: 'qbo_unreachable',
      message: 'QuickBooks API not reachable right now. Please try again.',
      detail: e?.message || null,
    });
  }
};
