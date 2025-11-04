const axios = require("axios");

// Base URL builder for QuickBooks API
function QBO(realmId) {
  return `https://${
    (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
      ? "sandbox-quickbooks.api.intuit.com"
      : "quickbooks.api.intuit.com"
  }/v3/company/${realmId}`;
}

// API minor version (latest stable)
const MINOR = 70;

// Standard headers builder
function headers(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

/**
 * Safe quote wrapper for QBO SQL strings.
 * Example: qboQuote("My Product") → "'My Product'"
 */
function qboQuote(str) {
  if (str === null || str === undefined) return "''";
  const safe = String(str).replace(/'/g, "''");
  return `'${safe}'`;
}

/**
 * Execute a QuickBooks SQL query via Query endpoint
 * @param {Object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.realmId
 * @param {string} opts.query - e.g., "select Id, Name from Item where Name = 'Coffee'"
 * @returns {Promise<Object>} Axios response
 */
async function qboQuery({ accessToken, realmId, query }) {
  const url = `${QBO(realmId)}/query?minorversion=${MINOR}&query=${encodeURIComponent(
    query
  )}`;

  try {
    const res = await axios.get(url, { headers: headers(accessToken) });
    return res.data;
  } catch (err) {
    const msg = err?.response?.data || err.message;
    console.error("[QBO Query Error]", msg);
    throw new Error(
      `QuickBooks query failed: ${msg?.Fault?.Error?.[0]?.Message || msg}`
    );
  }
}

module.exports = {
  QBO,
  MINOR,
  headers,
  qboQuote,
  qboQuery,
};
