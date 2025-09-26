// controllers/quickbooks.controller.js
// Core QBO helpers (single-tenant, multi-device safe refresh)
// npm i intuit-oauth axios
const OAuthClient = require('intuit-oauth');
const axios = require('axios');
const { qboToken } = require('../models'); // keep your model name
const { withDbLock } = require('../utils/dbLock'); // MySQL GET_LOCK

const ENV = process.env.QBO_ENV || 'sandbox';
const HOST =
  ENV === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';

// Minor versions <=74 are deprecated; default to 75 (or override via env)
const MINOR_VERSION = process.env.QBO_MINOR_VERSION || '75';

function oc() {
  return new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID,
    clientSecret: process.env.QBO_CLIENT_SECRET,
    environment: ENV,
    redirectUri: process.env.QBO_REDIRECT_URI,
  });
}

/* ----------------------- revoke detection (body + header) ------------------- */
function isRevokedError(e) {
  const status = e?.response?.status;
  const body = e?.response?.data;
  const wa = (e?.response?.headers?.['www-authenticate'] || '') + '';

  return (
    status === 401 &&
    // classic JSON body cases
    (body?.error === 'invalid_grant' ||
      body?.fault?.type === 'AUTHENTICATION' ||
      (Array.isArray(body?.fault?.error) &&
        body.fault.error.some(
          (er) => er?.code == '3200' || /token revoked/i.test(er?.detail),
        )) ||
      // header-only cases
      /error="?invalid_token"?/i.test(wa) ||
      /token revoked/i.test(wa))
  );
}
// map only supported Customer fields; no BillEmail here
function mapUserToQboCustomerBody(user, billingAddr) {
  return clean({
    DisplayName: (
      user.companyName ||
      user.name ||
      user.email ||
      'Customer'
    ).trim(),
    CompanyName: user.companyName || undefined,
    PrimaryEmailAddr: user.email ? { Address: user.email } : undefined,
    PrimaryPhone: user.phoneNumber
      ? { FreeFormNumber: user.phoneNumber }
      : undefined,
    BillAddr: billingAddr
      ? clean({
          Line1: billingAddr.addressLineOne || billingAddr.companyaddress,
          Line2: billingAddr.addressLineTwo,
          City: billingAddr.town,
          // State/Province code only when it’s valid (e.g., US). Otherwise omit.
          CountrySubDivisionCode:
            billingAddr.country === 'US' ? billingAddr.state : undefined,
          PostalCode: billingAddr.zipCode,
          Country: billingAddr.country,
        })
      : undefined,
  });
}

/* ---------------------------- token storage utils --------------------------- */
async function getTokenRowOrThrow() {
  const row = await qboToken.findOne({});
  if (!row) throw new Error('QuickBooks not connected');
  return row;
}

async function saveTokens(tokenJson, realmId) {
  const accessExp = new Date(Date.now() + tokenJson.expires_in * 1000); // ~60m
  const refreshExp = new Date(
    Date.now() +
      (tokenJson.x_refresh_token_expires_in || 100 * 24 * 3600) * 1000,
  ); // ~100d rolling (rotating!)
  await qboToken.destroy({ where: {} });
  await qboToken.create({
    realmId,
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token,
    accessTokenExpiresAt: accessExp,
    refreshTokenExpiresAt: refreshExp,
  });
}

// wipe tokens so app is marked disconnected (used on revocation)
async function clearTokens() {
  try {
    await qboToken.destroy({ where: {} }); // single-tenant: destroy-all is fine
  } catch (_) {
    /* ignore */
  }
}

/* ------------------------- access/refresh (race-safe) ----------------------- */
async function ensureAccess() {
  // 1) read latest
  let row = await getTokenRowOrThrow();

  // 2) fast path
  let remainingSec = Math.floor(
    (new Date(row.accessTokenExpiresAt) - Date.now()) / 1000,
  );
  if (remainingSec > 5) {
    return { accessToken: row.accessToken, realmId: row.realmId };
  }

  // 3) refresh under DB lock (avoid concurrent rotation)
  return withDbLock('qbo_token_refresh_lock', 10, async () => {
    const latest = await getTokenRowOrThrow();
    remainingSec = Math.floor(
      (new Date(latest.accessTokenExpiresAt) - Date.now()) / 1000,
    );
    if (remainingSec > 5) {
      return { accessToken: latest.accessToken, realmId: latest.realmId };
    }

    const oauth = oc();
    oauth.setToken({
      access_token: latest.accessToken,
      refresh_token: latest.refreshToken,
      token_type: 'bearer',
      expires_in: Math.max(1, remainingSec),
    });

    const r = await oauth.refreshUsingToken(latest.refreshToken);
    const t = r.getJson(); // includes a NEW refresh_token
    await saveTokens(t, latest.realmId); // rotate stored tokens
    return { accessToken: t.access_token, realmId: latest.realmId };
  });
}

/* ------------------------------ HTTP wrappers ------------------------------- */
async function qboPost(path, payload) {
  let { accessToken, realmId } = await ensureAccess();
  const url = `${HOST}/v3/company/${realmId}${path}?minorversion=${MINOR_VERSION}`;
  try {
    const { data } = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    return data;
  } catch (e) {
    if (isRevokedError(e)) {
      await clearTokens(); // mark disconnected
      const err = new Error('QuickBooks tokens revoked; reconnect required');
      err.code = 'QBO_TOKEN_REVOKED';
      throw err;
    }
    // Edge: access token expired between ensureAccess and call → retry once
    if (e?.response?.status === 401) {
      ({ accessToken } = await ensureAccess());
      const { data } = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
      return data;
    }
    throw e;
  }
}

async function qboGet(path) {
  let { accessToken, realmId } = await ensureAccess();
  const url = `${HOST}/v3/company/${realmId}${path}?minorversion=${MINOR_VERSION}`;
  console.log('🚀 ~ qboGet ~ HOST:', HOST);
  try {
    const { data } = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    return data;
  } catch (e) {
    if (isRevokedError(e)) {
      await clearTokens(); // mark disconnected
      const err = new Error('QuickBooks tokens revoked; reconnect required');
      err.code = 'QBO_TOKEN_REVOKED';
      throw err;
    }
    throw e;
  }
}

/* ------------------------------ small utilities ----------------------------- */
function clean(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const n = clean(v);
      if (n && Object.keys(n).length) out[k] = n;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/* --------------------------------- PUBLIC API ------------------------------- */
// OAuth start (frontend redirects using this URL)
exports.getAuthUrl = async () =>
  oc().authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'csrf-' + Date.now(),
  });

// OAuth callback (exchanges code and stores tokens)
exports.handleCallback = async (fullUrl) => {
  const oauth = oc();
  const resp = await oauth.createToken(fullUrl);
  const t = resp.getJson();
  const realmId = oauth.getToken().realmId;
  await saveTokens(t, realmId);
  return { realmId };
};

// Quick health (CompanyInfo) – used by middleware/status
exports.getCompanyInfo = async () => {
  const row = await qboToken.findOne();
  if (!row) throw new Error('QuickBooks not connected');
  const data = await qboGet(`/companyinfo/${row.realmId}`); // realmId required in path
  return data?.CompanyInfo;
};

// Create QBO Customer from your user + billingAddress
exports.createQboCustomerFromUser = async (user, billingAddr) => {
  const body = mapUserToQboCustomerBody(user, billingAddr);
  try {
    const data = await qboPost('/customer', body);
    return { id: data?.Customer?.Id, raw: data };
  } catch (e) {
    // Bubble useful details when something still fails
    const st = e?.response?.status || 500;
    const err0 = e?.response?.data?.fault?.error?.[0];
    const detail = err0?.detail || e?.response?.data;
    const message = err0?.message || e?.message;
    const code = err0?.code || 'qbo_error';
    throw Object.assign(new Error(message), {
      httpStatus: st,
      code,
      detail,
      sentKeys: Object.keys(body),
    });
  }
};

// Read a QBO Customer
// Replace your existing getQboCustomerById with this:

exports.getQboCustomerById = async (qboCustomerId) => {
  try {
    const id = String(qboCustomerId || '').trim();
    if (!id) {
      const err = new Error('qboCustomerId is required');
      err.code = 'QBO_ARG_REQUIRED';
      err.httpStatus = 400;
      throw err;
    }

    const data = await qboGet(`/customer/${encodeURIComponent(id)}`);

    if (!data || !data.Customer) {
      const err = new Error('Customer not found on QuickBooks');
      err.code = 'QBO_CUSTOMER_NOT_FOUND';
      err.httpStatus = 404;
      throw err;
    }

    return data.Customer;
  } catch (e) {
    // pass-through if our lower layer already normalized revocation
    if (e && e.code === 'QBO_TOKEN_REVOKED') throw e;

    const st = e?.response?.status;
    const err0 = e?.response?.data?.fault?.error?.[0];
    const code = (err0?.code || e?.code || '').toString();

    // QBO "Object Not Found" or true 404
    if (st === 404 || code === '610') {
      const err = new Error('Customer not found on QuickBooks');
      err.code = 'QBO_CUSTOMER_NOT_FOUND';
      err.httpStatus = 404;
      err.detail = err0?.detail || e?.response?.data || null;
      throw err;
    }

    // Rate limiting / throttling (optional handling)
    if (st === 429) {
      const err = new Error(
        'QuickBooks rate limit exceeded. Please retry later.',
      );
      err.code = 'QBO_RATE_LIMIT';
      err.httpStatus = 429;
      err.detail = e?.response?.headers || null;
      throw err;
    }

    // Generic mapper for other validation/auth issues
    const err = new Error(
      err0?.message || e?.message || 'Failed to fetch customer from QuickBooks',
    );
    err.code = err0?.code || e?.code || 'QBO_GET_CUSTOMER_FAILED';
    err.httpStatus = st || 500;
    err.detail = err0?.detail || e?.response?.data || null;
    throw err;
  }
};

// Build sparse update from local user+address
function buildSparseCustomerUpdate(user, billingAddr) {
  return clean({
    sparse: true,
    DisplayName: (user.companyName || user.name || '').trim() || undefined,
    PrimaryEmailAddr: user.email ? { Address: user.email } : undefined,
    BillEmail: user.emailToSendInvoices
      ? { Address: user.emailToSendInvoices }
      : undefined,
    PrimaryPhone: user.phoneNumber
      ? { FreeFormNumber: user.phoneNumber }
      : undefined,
    BillAddr: billingAddr
      ? clean({
          Line1: billingAddr.addressLineOne || billingAddr.companyaddress,
          Line2: billingAddr.addressLineTwo,
          City: billingAddr.town,
          CountrySubDivisionCode: billingAddr.state,
          PostalCode: billingAddr.zipCode,
          Country: billingAddr.country,
        })
      : undefined,
  });
}

// Update existing QBO Customer
exports.updateQboCustomerFromUser = async (
  user,
  billingAddr,
  currentSyncToken,
) => {
  if (!user.qboCustomerId)
    throw new Error('qboCustomerId is required to update QuickBooks customer.');

  // 1) ensure latest SyncToken
  let syncToken = currentSyncToken;
  if (!syncToken) {
    const remote = await exports.getQboCustomerById(user.qboCustomerId);
    syncToken = remote?.SyncToken;
    if (!syncToken)
      throw new Error('Unable to fetch SyncToken from QuickBooks.');
  }

  // 2) build sparse patch
  const patch = buildSparseCustomerUpdate(user, billingAddr);

  // 3) update
  const payload = clean({
    Id: String(user.qboCustomerId),
    SyncToken: String(syncToken),
    ...patch,
    sparse: true,
  });

  const data = await qboPost(`/customer?operation=update`, payload);
  const updated = data?.Customer;
  return { id: updated?.Id, syncToken: updated?.SyncToken, raw: data };
};

// (optional) disconnect helper for a route
exports.disconnect = async () => {
  await clearTokens();
  return { disconnected: true };
};
