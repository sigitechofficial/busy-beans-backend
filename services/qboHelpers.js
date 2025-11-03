// services/qboHelpers.js
const MINOR = 70;

// Base URL selection
const BASE =
  (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";

// Build full company base path
const QBO = (realmId) => `${BASE}/v3/company/${realmId}`;

// Standard headers for QBO requests
function headers(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

module.exports = {
  QBO,
  BASE,
  MINOR,
  headers,
};
