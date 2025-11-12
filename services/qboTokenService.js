// services/qboTokenService.js
const { qboToken } = require("../models");
const OAuthClient = require("intuit-oauth");
const qs = require("qs");
const axios = require("axios");
/**
 * Builds a configured Intuit OAuth client
 */
function buildClient() {
  return new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID,
    clientSecret: process.env.QBO_CLIENT_SECRET,
    environment: process.env.QBO_ENV || "sandbox",
    redirectUri: process.env.QBO_REDIRECT_URI,
  });
}

/**
 * Get the single active token row
 */
async function getActiveToken() {
  return await qboToken.findOne({ order: [["createdAt", "DESC"]] });
}

/**
 * Save (insert or update) tokens after successful exchange / refresh
 */
async function saveTokens({
  realmId,
  accessToken,
  refreshToken,
  expires_in,
  x_refresh_token_expires_in,
}) {
  const accessExp = new Date(Date.now() + (expires_in || 3600) * 1000);
  const refreshExp = new Date(
    Date.now() + (x_refresh_token_expires_in || 86400 * 100) * 1000
  );

  const existing = await getActiveToken();
  if (existing) {
    existing.realmId = realmId;
    existing.accessToken = accessToken;
    existing.refreshToken = refreshToken;
    existing.accessTokenExpiresAt = accessExp;
    existing.refreshTokenExpiresAt = refreshExp;
    await existing.save();
    return existing;
  }
  return await qboToken.create({
    realmId,
    accessToken,
    refreshToken,
    accessTokenExpiresAt: accessExp,
    refreshTokenExpiresAt: refreshExp,
  });
}

/**
 * Refresh the access token if expired; otherwise return existing one
 */

async function refreshAccessTokenIfNeeded({ condition }) {
  const record = await qboToken.findOne({ where: condition });
  console.log("🚀 ~ refreshAccessTokenIfNeeded ~ record:", record.id);
  if (!record) throw new Error("No QuickBooks token record found.");

  const now = new Date();

  // ✅ 1. If still valid, reuse access token
  if (record.accessTokenExpiresAt && record.accessTokenExpiresAt > now) {
    return {
      accessToken: record.accessToken,
      realmId: record.realmId,
    };
  }

  console.log("[QBO] Access token expired — refreshing…");

  // ✅ 2. Prepare refresh request
  const tokenUrl = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

  console.log("🚀 ~ refreshAccessTokenIfNeeded ~ tokenUrl:", tokenUrl);

  const body = qs.stringify({
    grant_type: "refresh_token",
    refresh_token: record.refreshToken,
  });

  const basicAuth = Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString("base64");

  try {
    // ✅ 3. Call QuickBooks to refresh tokens
    const response = await axios.post(tokenUrl, body, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
    });

    const data = response.data;

    const accessTokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    const refreshTokenExpiresAt = new Date(
      Date.now() + data.x_refresh_token_expires_in * 1000
    );

    // ✅ 4. Save new tokens to DB
    await record.update({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    });

    console.log("[QBO] Refreshed and updated tokens in DB");

    return {
      accessToken: data.access_token,
      realmId: record.realmId,
    };
  } catch (err) {
    const msg = err?.response?.data || err.message;
    console.error("[QBO] Failed to refresh token:", msg);

    // Optionally mark as disconnected in DB
    await record.update({ disconnected: true });

    throw new Error(
      "QuickBooks refresh token invalid or expired — please reconnect."
    );
  }
}

module.exports = { getActiveToken, saveTokens, refreshAccessTokenIfNeeded };
