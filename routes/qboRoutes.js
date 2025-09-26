// routes/qbo.routes.js
const express = require('express');
const ctrl = require('../controllers/admin/quikbooksController');
const qboConnected = require('../middlewares/qboConnected'); // optional guard
const { qboToken } = require('../models');
const router = express.Router();

// OAuth
router.get('/auth/login', ctrl.authLogin);
router.get('/auth/callback', ctrl.authCallback);
// routes/qbo.routes.js
router.get('/debug/config', (_req, res) => {
  res.json({
    env: process.env.QBO_ENV,
    hostFromEnv:
      process.env.QBO_ENV === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com',
    clientId_prefix: (process.env.QBO_CLIENT_ID || '').slice(0, 12),
    redirectUri: process.env.QBO_REDIRECT_URI,
    minorVersion: process.env.QBO_MINOR_VERSION || '75',
  });
});
// routes/qbo.routes.js
router.get('/debug/token-row', async (_req, res) => {
  const row = await qboToken.findOne();
  if (!row) return res.status(200).json({ hasRow: false });
  return res.status(200).json({
    hasRow: true,
    realmId: row.realmId,
    // add these columns in a migration if you haven't yet:
    clientId: row.clientId || null,
    env: row.env || null,
    redirectUri: row.redirectUri || null,
    accessExp: row.accessTokenExpiresAt,
    refreshExp: row.refreshTokenExpiresAt,
  });
});

// Status (optional)
router.get('/status', ctrl.status);

// Protected QBO ops (ensure connected)
// routes/qbo.routes.js
router.get('/debug/where-token-works', ctrl.debugWhereTokenWorks);

router.post('/customers/import', qboConnected, ctrl.importCustomers);
router.post('/customers/sync/:userId', qboConnected, ctrl.syncCustomerById);
router.post('/customers', qboConnected, ctrl.createCustomerFromBody);

router.get('/customers/:userId/pull', qboConnected, ctrl.pullCustomerAndCache);

router.put('/customers/:userId/update', qboConnected, ctrl.updateCustomerById);
module.exports = router;
