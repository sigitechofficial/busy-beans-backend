// controllers/qbo.routes.controller.js
// Thin handlers that use the core QBO controller
const QBO = require('../quickBooks');
const { user, billingAddress, qboToken } = require('../../models');

// GET /qbo/auth/login
exports.authLogin = async (_req, res) => {
  const url = await QBO.getAuthUrl();
  return res.redirect(url);
};

// GET /qbo/auth/callback
exports.authCallback = async (req, res) => {
  try {
    await QBO.handleCallback(req.url);
    return res.send('QuickBooks connected!');
  } catch (e) {
    console.error(e);
    return res.status(500).send('OAuth error');
  }
};

// GET /qbo/status  (optional helper)
exports.status = async (_req, res) => {
  try {
    const row = await qboToken.findOne();
    return res.json({
      connected: !!row,
      realmId: row?.realmId || null,
      accessExpiresInSec: row
        ? Math.max(
            0,
            Math.floor(
              (new Date(row.accessTokenExpiresAt) - Date.now()) / 1000,
            ),
          )
        : null,
    });
  } catch (e) {
    return res.json({ connected: false });
  }
};

// POST /qbo/customers/import  (bulk import existing users)
exports.importCustomers = async (_req, res) => {
  try {
    const users = await user.findAll({
      where: { deleted: false },
      include: [{ model: billingAddress, as: 'billingAddress' }],
    });

    const results = [];
    for (const u of users) {
      if (u.qboCustomerId) {
        results.push({
          userId: u.id,
          status: 'already_synced',
          qboCustomerId: u.qboCustomerId,
        });
        continue;
      }
      try {
        const out = await QBO.createQboCustomerFromUser(u, u.billingAddress);
        await u.update({
          qboCustomerId: out.id,
          qboSyncStatus: 'synced',
          qboSyncError: null,
        });
        results.push({ userId: u.id, status: 'synced', qboCustomerId: out.id });
      } catch (err) {
        await u.update({
          qboSyncStatus: 'error',
          qboSyncError: JSON.stringify(
            err?.response?.data || err?.message || err,
          ),
        });
        results.push({
          userId: u.id,
          status: 'error',
          error: err?.response?.data || err?.message,
        });
      }
    }

    return res.json({ message: 'Bulk import finished', results });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || 'Bulk import failed' });
  }
};

// POST /qbo/customers/sync/:userId  (sync specific user)
exports.syncCustomerById = async (req, res) => {
  try {
    const u = await user.findByPk(req.params.userId, {
      include: [{ model: billingAddress, as: 'billingAddress' }],
    });
    if (!u) return res.status(404).json({ error: 'User not found' });

    if (u.qboCustomerId) {
      return res.json({
        userId: u.id,
        status: 'already_synced',
        qboCustomerId: u.qboCustomerId,
      });
    }

    const out = await QBO.createQboCustomerFromUser(u, u.billingAddress);
    await u.update({
      qboCustomerId: out.id,
      qboSyncStatus: 'synced',
      qboSyncError: null,
    });

    return res.json({ userId: u.id, status: 'synced', qboCustomerId: out.id });
  } catch (e) {
    console.error(e?.response?.data || e);
    return res
      .status(500)
      .json({ error: 'Sync failed', detail: e?.response?.data || e?.message });
  }
};

// POST /qbo/customers  (create local user + QBO customer in one go)
exports.createCustomerFromBody = async (req, res) => {
  try {
    const u = await user.create({
      name: req.body.name,
      companyName: req.body.companyName,
      email: req.body.email,
      emailToSendInvoices: req.body.invoiceEmail,
      phoneNumber: req.body.phoneNumber,
    });

    let addr = null;
    if (req.body.billingAddress) {
      const BA = req.body.billingAddress;
      addr = await billingAddress.create({
        userId: u.id,
        addressLineOne: BA.addressLineOne,
        addressLineTwo: BA.addressLineTwo,
        town: BA.town,
        state: BA.state,
        zipCode: BA.zipCode,
        country: BA.country,
        companyaddress: BA.companyaddress,
      });
    }

    const out = await QBO.createQboCustomerFromUser(u, addr);
    await u.update({
      qboCustomerId: out.id,
      qboSyncStatus: 'synced',
      qboSyncError: null,
    });

    return res.status(201).json({
      message: 'Customer created locally & on QuickBooks',
      userId: u.id,
      qboCustomerId: out.id,
    });
  } catch (e) {
    console.error(e?.response?.data || e);
    return res.status(500).json({
      error: 'Create failed',
      detail: e?.response?.data || e?.message,
    });
  }
};

// GET /qbo/customers/:userId/pull
// Fetch current QBO customer and cache its SyncToken locally
exports.pullCustomerAndCache = async (req, res) => {
  try {
    const u = await user.findByPk(req.params.userId);
    if (!u || !u.qboCustomerId)
      return res
        .status(404)
        .json({ error: 'User not found or not linked to QBO' });

    const remote = await QBO.getQboCustomerById(u.qboCustomerId);
    const syncToken = remote?.SyncToken || null;
    if (syncToken) {
      await u.update({ qboSyncToken: syncToken });
    }
    return res.json({ qboCustomerId: u.qboCustomerId, syncToken, remote });
  } catch (e) {
    console.error(e?.response?.data || e);
    return res
      .status(500)
      .json({ error: 'Pull failed', detail: e?.response?.data || e?.message });
  }
};

// PUT /qbo/customers/:userId/update
// Push local user fields to QBO Customer (uses latest SyncToken)
exports.updateCustomerById = async (req, res) => {
  try {
    const u = await user.findByPk(req.params.userId, {
      include: [{ model: billingAddress, as: 'billingAddress' }],
    });
    if (!u || !u.qboCustomerId)
      return res
        .status(404)
        .json({ error: 'User not found or not linked to QBO' });

    // if client sent "billingAddress" overrides in body, allow patching local address before pushing
    let addr = u.billingAddress;
    if (req.body.billingAddress) {
      // optional: update local billingAddress first
      if (addr) {
        await addr.update({
          addressLineOne:
            req.body.billingAddress.addressLineOne ?? addr.addressLineOne,
          addressLineTwo:
            req.body.billingAddress.addressLineTwo ?? addr.addressLineTwo,
          town: req.body.billingAddress.town ?? addr.town,
          state: req.body.billingAddress.state ?? addr.state,
          zipCode: req.body.billingAddress.zipCode ?? addr.zipCode,
          country: req.body.billingAddress.country ?? addr.country,
          companyaddress:
            req.body.billingAddress.companyaddress ?? addr.companyaddress,
        });
      }
      addr =
        addr ||
        (await billingAddress.create({
          userId: u.id,
          ...req.body.billingAddress,
        }));
    }

    // Optionally allow local user field patches via body
    const allowedUserFields = [
      'name',
      'companyName',
      'email',
      'emailToSendInvoices',
      'phoneNumber',
    ];
    const userPatch = {};
    for (const f of allowedUserFields)
      if (f in req.body) userPatch[f] = req.body[f];
    if (Object.keys(userPatch).length) await u.update(userPatch);

    // Push to QBO
    const out = await QBO.updateQboCustomerFromUser(u, addr, u.qboSyncToken);
    await u.update({
      qboSyncToken: out.syncToken || u.qboSyncToken,
      qboLastSyncedAt: new Date(),
      qboSyncStatus: 'synced',
      qboSyncError: null,
    });

    return res.json({
      message: 'Customer updated on QuickBooks',
      qboCustomerId: u.qboCustomerId,
      syncToken: out.syncToken,
    });
  } catch (e) {
    console.error(e?.response?.data || e);
    return res.status(500).json({
      error: 'Update failed',
      detail: e?.response?.data || e?.message,
    });
  }
};
