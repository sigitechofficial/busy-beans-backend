// controllers/quickbooks.controller.js
// Core QBO helpers (single-tenant, multi-device safe refresh)
// npm i intuit-oauth axios
const OAuthClient = require('intuit-oauth');
const axios = require('axios');
const { QboToken } = require('../models'); // optional: if you didn't add the model yet, create it
const { withDbLock } = require('../utils/dbLock'); // distributed lock using MySQL GET_LOCK

const ENV = process.env.QBO_ENV || 'sandbox';
const HOST =
  ENV === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';

function oc() {
  return new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID,
    clientSecret: process.env.QBO_CLIENT_SECRET,
    environment: ENV,
    redirectUri: process.env.QBO_REDIRECT_URI,
  });
}

// ----- token storage (single row) -----
async function getTokenRowOrThrow() {
  const row = await QboToken.findOne();
  if (!row) throw new Error('QuickBooks not connected');
  return row;
}

async function saveTokens(tokenJson, realmId) {
  const accessExp = new Date(Date.now() + tokenJson.expires_in * 1000); // ~60m
  const refreshExp = new Date(
    Date.now() +
      (tokenJson.x_refresh_token_expires_in || 100 * 24 * 3600) * 1000,
  ); // ~100d rolling

  const row = await QboToken.findOne();
  if (!row) {
    await QboToken.create({
      realmId,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
      accessTokenExpiresAt: accessExp,
      refreshTokenExpiresAt: refreshExp,
    });
  } else {
    await row.update({
      realmId,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token, // always rotate to newest
      accessTokenExpiresAt: accessExp,
      refreshTokenExpiresAt: refreshExp,
    });
  }
}

async function ensureAccess() {
  const row = await getTokenRowOrThrow();

  // fast path: try current token
  let remainingSec = Math.floor(
    (new Date(row.accessTokenExpiresAt) - Date.now()) / 1000,
  );
  if (remainingSec > 5) {
    return { accessToken: row.accessToken, realmId: row.realmId };
  }

  // slow path: refresh under DB lock to avoid races across devices/instances
  return withDbLock('qbo_token_refresh_lock', 10, async () => {
    const latest = await getTokenRowOrThrow();
    // recalc remaining with latest row
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
    const t = r.getJson();
    await saveTokens(t, latest.realmId);
    return { accessToken: t.access_token, realmId: latest.realmId };
  });
}

async function qboPost(path, payload) {
  let { accessToken, realmId } = await ensureAccess();
  const url = `${HOST}/v3/company/${realmId}${path}?minorversion=70`;
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
    // retry once on 401 (just in case)
    if (e?.response?.status === 401) {
      ({ accessToken, realmId } = await ensureAccess());
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

// ---------- PUBLIC API ----------

// OAuth start
exports.getAuthUrl = async () =>
  oc().authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'csrf-' + Date.now(),
  });

// OAuth callback
exports.handleCallback = async (fullUrl) => {
  const oauth = oc();
  const resp = await oauth.createToken(fullUrl);
  const t = resp.getJson();
  const realmId = oauth.getToken().realmId;
  await saveTokens(t, realmId);
  return { realmId };
};

// Create QBO Customer from your user + billingAddress
exports.createQboCustomerFromUser = async (user, billingAddr) => {
  const body = {
    DisplayName: (user.companyName || user.name || '').trim(),
    PrimaryEmailAddr: user.email ? { Address: user.email } : undefined,
    BillEmail: user.emailToSendInvoices
      ? { Address: user.emailToSendInvoices }
      : undefined,
    PrimaryPhone: user.phoneNumber
      ? { FreeFormNumber: user.phoneNumber }
      : undefined,
    BillAddr: billingAddr
      ? {
          Line1:
            billingAddr.addressLineOne ||
            billingAddr.companyaddress ||
            undefined,
          Line2: billingAddr.addressLineTwo || undefined,
          City: billingAddr.town || undefined,
          CountrySubDivisionCode: billingAddr.state || undefined,
          PostalCode: billingAddr.zipCode || undefined,
          Country: billingAddr.country || undefined,
        }
      : undefined,
  };

  const data = await qboPost('/customer', body);
  return { id: data?.Customer?.Id, raw: data };
};

// (Optional) update customer later — requires Id & SyncToken; add when needed.

// controllers/quickbooks.controller.js  (additions only)

// ---------- add near qboPost ----------
async function qboGet(path) {
  const { accessToken, realmId } = await ensureAccess();
  const url = `${HOST}/v3/company/${realmId}${path}?minorversion=70`;
  const { data } = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  return data;
}

// ---------- existing export: createQboCustomerFromUser(...) stays as-is ----------

// ---------- NEW: fetch a Customer by QBO Id (helper) ----------
exports.getQboCustomerById = async (qboCustomerId) => {
  const data = await qboGet(`/customer/${qboCustomerId}`);
  // data.Customer should be present
  return data.Customer;
};

// ---------- mapper reused for update ----------
function buildSparseCustomerUpdate(user, billingAddr) {
  const patch = {
    // NOTE: Id & SyncToken will be injected by update function
    sparse: true,
    DisplayName: (user.companyName || user.name || '').trim(),
    PrimaryEmailAddr: user.email ? { Address: user.email } : undefined,
    BillEmail: user.emailToSendInvoices
      ? { Address: user.emailToSendInvoices }
      : undefined,
    PrimaryPhone: user.phoneNumber
      ? { FreeFormNumber: user.phoneNumber }
      : undefined,
    BillAddr: billingAddr
      ? {
          Line1:
            billingAddr.addressLineOne ||
            billingAddr.companyaddress ||
            undefined,
          Line2: billingAddr.addressLineTwo || undefined,
          City: billingAddr.town || undefined,
          CountrySubDivisionCode: billingAddr.state || undefined,
          PostalCode: billingAddr.zipCode || undefined,
          Country: billingAddr.country || undefined,
        }
      : undefined,
  };

  // remove undefined keys so QBO doesn’t clear fields unintentionally
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
  if (patch.BillAddr) {
    Object.keys(patch.BillAddr).forEach(
      (k) => patch.BillAddr[k] === undefined && delete patch.BillAddr[k],
    );
    if (!Object.keys(patch.BillAddr).length) delete patch.BillAddr;
  }
  return patch;
}

// ---------- NEW: update Customer on QBO from local user ----------
exports.updateQboCustomerFromUser = async (
  user,
  billingAddr,
  currentSyncToken,
) => {
  if (!user.qboCustomerId)
    throw new Error('qboCustomerId is required to update QuickBooks customer.');

  // 1) Ensure we have latest SyncToken
  let syncToken = currentSyncToken;
  if (!syncToken) {
    const remote = await exports.getQboCustomerById(user.qboCustomerId);
    syncToken = remote?.SyncToken;
    if (!syncToken)
      throw new Error('Unable to fetch SyncToken from QuickBooks.');
  }

  // 2) Build sparse patch with Id + SyncToken
  const patch = buildSparseCustomerUpdate(user, billingAddr);
  const payload = {
    Id: String(user.qboCustomerId),
    SyncToken: String(syncToken),
    ...patch,
    sparse: true,
  };

  // 3) QBO update (use ?operation=update)
  const data = await qboPost(`/customer?operation=update`, payload);

  // 4) Return new SyncToken (it changes every update)
  const updated = data?.Customer;
  return { id: updated?.Id, syncToken: updated?.SyncToken, raw: data };
};
