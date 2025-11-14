// services/qboAuthService.js
const axios = require("axios");
const { qboToken, qboCustomerMap, account, salesRep } = require("../models"); // Adjust based on how you export models
const qs = require("qs");

// Helper: environment variables
const clientId = process.env.QBO_CLIENT_ID;
const clientSecret = process.env.QBO_CLIENT_SECRET;
const redirectUri = process.env.QBO_REDIRECT_URI;

// ✅ Single correct URL for both sandbox & production
const tokenUrl = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

/**
 * Exchanges a full redirect URL from QuickBooks (contains code + realmId)
 * for access + refresh tokens, and stores them in DB.
 */
async function exchangeFromFullUrl({ fullUrl, req }) {
  const u = new URL(fullUrl);
  const code = u.searchParams.get("code");
  const realmId = u.searchParams.get("realmId");

  if (!code || !realmId) {
    throw new Error("Missing code or realmId in QuickBooks callback URL.");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );
  const body = qs.stringify({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await axios.post(tokenUrl, body, {
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
  });

  const {
    access_token,
    refresh_token,
    expires_in,
    x_refresh_token_expires_in,
  } = response.data;

  const accessTokenExpiresAt = new Date(Date.now() + expires_in * 1000);
  const refreshTokenExpiresAt = new Date(
    Date.now() + x_refresh_token_expires_in * 1000
  );

  // Save or update tokens in DB

  condition = {};
  const { localPartnerId, adminId } = req?.user || {};
  console.log("🚀 ~ exchangeFromFullUrl ~ FOR LOCAL PARTNER:", localPartnerId);
  console.log("🚀 ~ exchangeFromFullUrl ~ FOR ADMIN:", adminId);
  condition.accountId = adminId || null;
  condition.salesRepId = localPartnerId || null;
  const input = {
    realmId,
    accessToken: access_token,
    refreshToken: refresh_token,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
    ...condition,
  };
  const MODEL = adminId ? account : salesRep;
  console.log("🚀 ~ exchangeFromFullUrl ~ MODEL:", MODEL);

  MODEL.update(
    { currentRealmId: realmId },
    { where: { id: adminId || localPartnerId } }
  );
  console.log("🚀 ~ exchangeFromFullUrl ~ input:", input);

  const existing = await qboToken.findOne({ where: condition });
  if (existing) {
    await existing.update(input);
  } else {
    await qboToken.create(input);
  }

  return {
    realmId,
    accessToken: access_token,
    refreshToken: refresh_token,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
    localPartnerId,
    adminId,
  };
}

module.exports = { exchangeFromFullUrl };
