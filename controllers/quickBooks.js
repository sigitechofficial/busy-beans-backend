// controllers/quickbooks.js
// Stateless QuickBooks helpers: build auth URL, exchange redirect -> tokens,
// ping company info, and create a basic customer (no address).
// 🔊 Heavy console logs included (tokens are redacted).

const OAuthClient = require('intuit-oauth');
const axios = require('axios');

const ENV = process.env.QBO_ENV || 'sandbox';
const HOST =
  ENV === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
const MINOR_VERSION = process.env.QBO_MINOR_VERSION || '75';

/* ------------------------------- logging utils ------------------------------ */
function red(s, head = 6, tail = 4) {
  if (!s || typeof s !== 'string') return s;
  if (s.length <= head + tail) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
function logpfx(fn) {
  return `[QBO:${fn}]`;
}

/* --------------------------------- oauth ----------------------------------- */
function oc() {
  return new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID,
    clientSecret: process.env.QBO_CLIENT_SECRET,
    environment: ENV,
    redirectUri: process.env.QBO_REDIRECT_URI, // MUST match Intuit Dev (Development) exactly
  });
}

/* ------------------------------ public helpers ----------------------------- */

// 1) Build authorization URL
exports.getAuthUrl = async (state) => {
  const s = state || `csrf-${Date.now()}`;
  const url = oc().authorizeUri({ scope: [OAuthClient.scopes.Accounting], state: s });
  console.log(logpfx('authUrl'), 'ENV=', ENV, 'HOST=', HOST, 'state=', s);
  return url;
};

// 2) Exchange FULL redirect URL → tokens (no saving, just return)
exports.exchangeFromFullUrl = async (fullRedirectUrl) => {
  const tag = logpfx('exchange');
  console.log(tag, 'incoming fullUrl=', fullRedirectUrl);

  if (!fullRedirectUrl || !fullRedirectUrl.includes('code=') || !fullRedirectUrl.includes('realmId=')) {
    const err = new Error('fullUrl must contain ?code= and &realmId=');
    err.code = 'QBO_BAD_REDIRECT_URL';
    console.error(tag, err.message);
    throw err;
  }

  const oauth = oc();
  try {
    const resp = await oauth.createToken(fullRedirectUrl);
    const t = resp.getJson();
    const realmId = oauth.getToken().realmId;

    console.log(tag, 'SUCCESS exchange:',
      'realmId=', realmId,
      'access.len=', (t.access_token || '').length,
      'refresh.len=', (t.refresh_token || '').length,
      'expires_in=', t.expires_in,
      'x_refresh_expires_in=', t.x_refresh_token_expires_in
    );

    return {
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_in: t.expires_in,
      x_refresh_token_expires_in: t.x_refresh_token_expires_in,
      realmId,
    };
  } catch (e) {
    console.log(e)
    const st = e?.response?.status;
    const body = e?.response?.data;
    console.error(tag, 'FAILED exchange:',
      'status=', st,
      'error=', body?.error,
      'desc=', body?.error_description,
      'fault=', JSON.stringify(body?.fault)
    );
    throw e;
  }
};

// 3) Ping company info (uses given token, NO refresh)
exports.getCompanyInfoWithToken = async (accessToken, realmId) => {
  const tag = logpfx('ping');
  const url = `${HOST}/v3/company/${realmId}/companyinfo/${realmId}?minorversion=${MINOR_VERSION}`;
  console.log(tag, 'GET', url, 'token=', red(accessToken));

  try {
    const { data, status } = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      validateStatus: () => true,
    });
    console.log(tag, 'RESP status=', status, 'hasCompanyInfo=', !!data?.CompanyInfo);
    if (status >= 200 && status < 300) return data?.CompanyInfo || null;

    const wa = e?.response?.headers?.['www-authenticate'];
    console.error(tag, 'ERR status=', status, 'www-auth=', wa, 'body=', JSON.stringify(data));
    const err = new Error('Ping failed');
    err.httpStatus = status;
    err.body = data;
    throw err;
  } catch (e) {
    const st = e?.response?.status;
    const wa = e?.response?.headers?.['www-authenticate'];
    console.error(tag, 'EXCEPTION status=', st, 'www-auth=', wa, 'body=', e?.response?.data || e?.message);
    throw e;
  }
};
// pick first active (status && !deleted), else first available
const pickAddress = (list) =>
  list?.find(a => a?.status && !a?.deleted) ?? list?.[0] ?? null;

// map our address shape -> QBO address shape
const toQboAddr = (a) => {
  if (!a) return undefined; // undefined -> key omitted from JSON
  return {
    Line1: a.addressLineOne || undefined,
    Line2: a.addressLineTwo || undefined,
    City: a.town || undefined,
    CountrySubDivisionCode: a.state || undefined, // e.g. "FL"
    PostalCode: a.zipCode || undefined,
    Country: a.country || undefined,
  };
};
// 4) Create basic Customer (DisplayName/CompanyName/PrimaryEmailAddr only)
exports.createCustomerBasicWithToken = async (accessToken, realmId, u) => {
  const tag = logpfx('createCustomer');
  const url = `${HOST}/v3/company/${realmId}/customer?minorversion=${MINOR_VERSION}`;
 
const ship = pickAddress(u.addresses);
const bill = pickAddress(u.billingAddresses) ?? ship; // fallback to ship if billing missing

 
  const body = {
    DisplayName: u.companyName || u.name,
    CompanyName: u.companyName || undefined,
    GivenName: u.name || undefined,
    PrimaryEmailAddr: u.email ? { Address: u.email } : undefined,
    PrimaryPhone: u.phoneNumber ? { FreeFormNumber: u.phoneNumber } : undefined,
    // ⬇️ NEW: addresses
    BillAddr: toQboAddr(bill),
    ShipAddr: toQboAddr(ship),
  };
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

  console.log(tag, 'POST', url, 'token=', red(accessToken), 'payload=', body);

  try {
    const { data, status, headers } = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    });
    const customerId = data?.Customer?.Id;
    console.log(tag, 'RESP status=', status, 'customerId=', customerId);

    if (status >= 200 && status < 300) return { id: customerId, raw: data };

    const wa = headers?.['www-authenticate'];
    console.error(tag, 'ERR status=', status, 'www-auth=', wa, 'body=', JSON.stringify(data));
    const err0 = data?.fault?.error?.[0];
    const err = new Error(err0?.message || 'QBO error');
    err.code = err0?.code || 'QBO_ERROR';
    err.detail = err0?.detail || data;
    err.httpStatus = status;
    throw err;
  } catch (e) {
    const st = e?.response?.status;
    const wa = e?.response?.headers?.['www-authenticate'];
    console.error(tag, 'EXCEPTION status=', st, 'www-auth=', wa, 'body=', e?.response?.data || e?.message);
    throw e;
  }
};
