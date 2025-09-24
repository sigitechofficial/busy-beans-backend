// routes/qbo.routes.js
const express = require('express');
const ctrl = require('../controllers/admin/quikbooksController');
const qboConnected = require('../middlewares/qboConnected'); // optional guard

const router = express.Router();

// OAuth
router.get('/auth/login', ctrl.authLogin);
router.get('/auth/callback', ctrl.authCallback);

// Status (optional)
router.get('/status', ctrl.status);

// Protected QBO ops (ensure connected)
router.post('/customers/import', qboConnected, ctrl.importCustomers);
router.post('/customers/sync/:userId', qboConnected, ctrl.syncCustomerById);
router.post('/customers', qboConnected, ctrl.createCustomerFromBody);

router.get('/customers/:userId/pull', qboConnected, ctrl.pullCustomerAndCache);

router.put('/customers/:userId/update', qboConnected, ctrl.updateCustomerById);
module.exports = router;
