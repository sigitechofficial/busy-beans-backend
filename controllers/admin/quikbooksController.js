// controllers/qbo.routes.controller.js
// Thin handlers that use the core QBO controller
const QBO = require('../quickBooks');
const { user, billingAddress, qboToken } = require('../../models');
const axios = require('axios');
function pickBillingAddress(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  // Prefer first "active" and not deleted; else just first
  const active = list.find(
    (a) => a && a.status !== false && a.deleted !== true,
  );
  return active || list[0] || null;
}
// GET /qbo/auth/login
exports.authLogin = async (req, res) => {
  try {
    // Optional: accept state from client; otherwise generate here
    const state =
      (req.query.state && String(req.query.state)) || `csrf-${Date.now()}`;

    // If you want to validate state on callback, persist it:
    // await saveState(state);

    const url = await QBO.getAuthUrl(state);
    return res.status(200).json({
      status: 'success',
      data: { authUrl: url, state },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to generate QuickBooks auth URL',
      detail: e?.message,
    });
  }
};

// GET /qbo/auth/callback
// controllers/qbo.routes.controller.js
exports.authCallback = async (req, res) => {
  try {
    if (req.query?.error) {
      const httpStatus = 400;
      return res.status(httpStatus).json({
        status: 'error',
        httpStatus,
        error: String(req.query.error),
        message: String(req.query.error_description || 'Authorization failed'),
        state: req.query.state || null,
      });
    }
    await QBO.handleCallback(req.url);
    return res
      .status(200)
      .json({ status: 'success', data: { connected: true } });
  } catch (e) {
    const httpStatus = e?.response?.status || 500;
    const body = e?.response?.data || {};
    const fault = body?.fault?.error?.[0];
    return res.status(httpStatus).json({
      status: 'error',
      httpStatus,
      error: body?.error || fault?.code || e?.code || 'oauth_callback_error',
      message:
        body?.error_description ||
        fault?.message ||
        body?.message ||
        e?.message ||
        'OAuth callback failed',
      detail:
        fault?.detail ||
        body?.detail ||
        (typeof body === 'string' ? body : undefined),
    });
  }
};

exports.status = async (_req, res) => {
  try {
    const row = await qboToken.findOne();
    if (!row) {
      return res
        .status(200)
        .json({ status: 'success', data: { connected: false } });
    }

    const now = Date.now();
    const accessLeftSec = Math.max(
      0,
      Math.floor((new Date(row.accessTokenExpiresAt) - now) / 1000),
    );
    const refreshLeftSec = Math.max(
      0,
      Math.floor((new Date(row.refreshTokenExpiresAt) - now) / 1000),
    );

    // If refresh token is expired -> wipe tokens (disconnected)
    if (refreshLeftSec === 0) {
      await row.destroy();
      return res
        .status(200)
        .json({ status: 'success', data: { connected: false } });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        connected: true,
        realmId: row.realmId,
        accessExpiresInSec: accessLeftSec,
        refreshExpiresInSec: refreshLeftSec,
      },
    });
  } catch (e) {
    return res
      .status(200)
      .json({ status: 'success', data: { connected: false } });
  }
};

// POST /qbo/customers/import  (bulk import existing users)
// controllers/qbo.routes.controller.js
exports.importCustomers = async (req, res) => {
  // (optional) prevent super long hangs
  res.setTimeout(120000); // 2 minutes

  const startedAt = Date.now();
  try {
    const users = await user.findAll({
      where: {
        id: req.body.ids,
        deleted: 0,
      },
      include: [{ model: billingAddress, required: false }],
      limit: 2,
    });
    console.log('🚀 ~ users:', JSON.parse(JSON.stringify(users)));
    console.log(
      '🚀 ~ users:billingAddress',
      JSON.parse(JSON.stringify(users?.billingAddress || {})),
    );

    const results = [];

    // IMPORTANT: for…of (NOT forEach)
    for (const u of users) {
      const addr = pickBillingAddress(u.billingAddresses);
      console.log('🚀 ~ addr:', addr);
      console.log('🚀 ~ addr:', addr);
      console.log('🚀 ~ addr:', addr);

      try {
        if (u.qboCustomerId) {
          // update on QBO (if you want upsert behavior)
          const { syncToken } = await QBO.updateQboCustomerFromUser(
            u,
            addr,
            u.qboSyncToken,
          );
          await u.update({
            qboSyncToken: syncToken || u.qboSyncToken,
            qboSyncStatus: 'ok',
            qboSyncError: null,
            qboLastSyncedAt: new Date(),
          });
          results.push({
            userId: u.id,
            status: 'ok',
            action: 'updated',
            qboCustomerId: u.qboCustomerId,
          });
        } else {
          // create on QBO
          const { id } = await QBO.createQboCustomerFromUser(u, addr);
          await u.update({
            qboCustomerId: id,
            qboSyncStatus: 'ok',
            qboSyncError: null,
            qboLastSyncedAt: new Date(),
          });
          results.push({
            userId: u.id,
            status: 'ok',
            action: 'created',
            qboCustomerId: id,
          });
        }
      } catch (e) {
        // if tokens got revoked mid-run, stop and ask to reconnect
        if (e.code === 'QBO_TOKEN_REVOKED') {
          return res.status(428).json({
            status: 'auth-require',
            error: 'qbo_token_revoked',
            message: 'QuickBooks connection was revoked. Please connect again.',
            reconnectUrlEndpoint: '/qbo/auth/login',
          });
        }

        const st = e?.httpStatus || e?.response?.status || 500;
        const err0 = e?.response?.data?.fault?.error?.[0];
        const code = err0?.code || e?.code || 'qbo_error';
        const message = err0?.message || e?.message || 'QBO error';
        const detail = err0?.detail || e?.response?.data || null;

        // record per-user failure but keep going
        results.push({ userId: u.id, status: 'error', code, message });
        await u.update({
          qboSyncStatus: 'error',
          qboSyncError: JSON.stringify({ code, message, detail }),
          qboLastSyncedAt: null,
        });
      }
    }

    // SINGLE response at the end
    return res.status(200).json({
      status: 'success',
      message: 'Bulk import finished',
      count: results.length,
      tookMs: Date.now() - startedAt,
      results,
    });
  } catch (e) {
    // catch anything else (DB, coding errors, etc.)
    return res.status(500).json({
      status: 'error',
      message: e?.message || 'Import failed',
    });
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

exports.debugWhereTokenWorks = async (_req, res) => {
  try {
    const row = await qboToken.findOne();
    if (!row)
      return res
        .status(400)
        .json({ status: 'error', message: 'No tokens saved' });
    const { accessToken, realmId } = row;

    const hosts = [
      'https://sandbox-quickbooks.api.intuit.com',
      'https://quickbooks.api.intuit.com',
    ];
    const results = [];

    for (const h of hosts) {
      const url = `${h}/v3/company/${realmId}/companyinfo/${realmId}?minorversion=${process.env.QBO_MINOR_VERSION || '75'}`;
      try {
        const r = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
          validateStatus: () => true,
        });
        results.push({
          host: h,
          status: r.status,
          ok: r.status >= 200 && r.status < 300,
          wwwAuthenticate: r.headers?.['www-authenticate'] || null,
          body: r.data || null,
        });
      } catch (err) {
        results.push({
          host: h,
          status: err?.response?.status || null,
          ok: false,
          wwwAuthenticate: err?.response?.headers?.['www-authenticate'] || null,
          body: err?.response?.data || String(err),
        });
      }
    }

    return res.json({
      env: process.env.QBO_ENV,
      hostFromEnv:
        process.env.QBO_ENV === 'production'
          ? 'https://quickbooks.api.intuit.com'
          : 'https://sandbox-quickbooks.api.intuit.com',
      realmId,
      results,
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e?.message });
  }
};
