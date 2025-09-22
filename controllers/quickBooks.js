// controllers/quickbooks.controller.js
// Dependencies: npm i intuit-oauth axios
const OAuthClient = require('intuit-oauth');
const axios = require('axios');

/**
 * Token storage adapter — DB ya file ke through persist karein.
 * Yahan default in-memory example diya hai; apni Sequelize TokenModel ke saath replace kar dein.
 */
const TokenStore = {
  _cache: null,
  async get() {
    // TODO: DB se fetch karein (per-tenant/company)
    return this._cache;
  },
  async set(tokens) {
    // TODO: DB me save karein (encrypt at rest)
    this._cache = tokens;
  },
  async clear() {
    this._cache = null;
  },
};

const ENV = process.env.QBO_ENV || 'sandbox';
const QBO_HOST =
  ENV === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';

function buildOAuthClient() {
  return new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID,
    clientSecret: process.env.QBO_CLIENT_SECRET,
    environment: ENV, // 'sandbox' | 'production'
    redirectUri: process.env.QBO_REDIRECT_URI,
  });
}

async function getFreshAccessToken(oauth, tokens) {
  // tokens: { access_token, refresh_token, realmId, expires_in, x_refresh_token_expires_in }
  oauth.setToken(tokens); // load current
  if (!oauth.isAccessTokenValid()) {
    const r = await oauth.refreshUsingToken(tokens.refresh_token);
    const t = r.getJson();
    const merged = {
      ...t,
      realmId: oauth.getToken().realmId || tokens.realmId,
    };
    await TokenStore.set(merged);
    return merged.access_token;
  }
  return tokens.access_token;
}

function baseUrl(realmId) {
  if (!realmId) throw new Error('QuickBooks realmId missing. Connect first.');
  return `${QBO_HOST}/v3/company/${realmId}`;
}

/**
 * PUBLIC: getAuthUrl()
 * QBO connect flow start karne ke liye URL return karta hai.
 */
async function getAuthUrl(state = 'csrf-' + Date.now()) {
  const oauth = buildOAuthClient();
  const url = oauth.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state,
  });
  return url;
}

/**
 * PUBLIC: handleCallback(fullUrlFromQBO)
 * OAuth callback hit hone par tokens store karta hai.
 */
async function handleCallback(fullUrl) {
  const oauth = buildOAuthClient();
  const resp = await oauth.createToken(fullUrl);
  const t = resp.getJson();
  const realmId = oauth.getToken().realmId;
  await TokenStore.set({ ...t, realmId });
  return { realmId };
}

/**
 * INTERNAL: POST helper
 */
async function qboPost(path, payload) {
  const oauth = buildOAuthClient();
  const tokens = await TokenStore.get();
  if (!tokens)
    throw new Error(
      'QBO not connected; call getAuthUrl() → handleCallback() first.',
    );
  const accessToken = await getFreshAccessToken(oauth, tokens);
  const url = `${baseUrl(tokens.realmId)}${path}?minorversion=70`;
  const { data } = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
  return data;
}

/**
 * PUBLIC: syncCustomer(input)
 * input example:
 * {
 *   displayName: "Ali Traders",
 *   email: "ali@traders.pk",
 *   phone: "0300-0000000",
 *   billAddr: { line1, city, state, postalCode, country }  // optional
 * }
 * Return: { id, raw }
 */
async function syncCustomer(input) {
  const body = {
    DisplayName: input.displayName,
    PrimaryEmailAddr: input.email ? { Address: input.email } : undefined,
    PrimaryPhone: input.phone ? { FreeFormNumber: input.phone } : undefined,
    BillAddr: input.billAddr
      ? {
          Line1: input.billAddr.line1,
          City: input.billAddr.city,
          CountrySubDivisionCode: input.billAddr.state,
          PostalCode: input.billAddr.postalCode,
          Country: input.billAddr.country,
        }
      : undefined,
  };

  const data = await qboPost('/customer', body);
  return { id: data?.Customer?.Id, raw: data };
}

/**
 * PUBLIC: createInvoice(input)
 * input example:
 * {
 *   qboCustomerId: "123",             // required (preferably after syncCustomer)
 *   lines: [ { name: "Website", amount: 5000, itemRefId: "1" } ],
 *   note: "Local invoice #42"
 * }
 * Return: { id, docNumber, raw }
 */
async function createInvoice(input) {
  if (!input.qboCustomerId)
    throw new Error('qboCustomerId is required to create invoice.');

  const Line = (input.lines || []).map((l) => ({
    DetailType: 'SalesItemLineDetail',
    Amount: Number(l.amount),
    Description: l.name,
    SalesItemLineDetail: {
      // In sandbox, "1" is usually a generic Services item. Use real Item IDs in prod.
      ItemRef: { value: l.itemRefId || '1' },
    },
  }));

  const body = {
    CustomerRef: { value: String(input.qboCustomerId) },
    Line,
    PrivateNote: input.note || 'Created via API',
  };

  const data = await qboPost('/invoice', body);
  return {
    id: data?.Invoice?.Id,
    docNumber: data?.Invoice?.DocNumber,
    raw: data,
  };
}

module.exports = {
  // OAuth
  getAuthUrl,
  handleCallback,

  // Business ops
  syncCustomer,
  createInvoice,

  // For custom storage wiring (optional export)
  TokenStore,
};
