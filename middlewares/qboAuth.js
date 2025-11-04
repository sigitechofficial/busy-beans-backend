// middleware/qboAuth.js
const { refreshAccessTokenIfNeeded } = require("../services/qboTokenService");

module.exports = async function qboAuth(req, res, next) {
  try {
    // ✅ Always ensure valid access token (auto-refreshes if expired)
    const { accessToken, realmId } = await refreshAccessTokenIfNeeded();

    if (!accessToken || !realmId) {
      console.warn("[QBO middleware] Missing QuickBooks credentials.");
      return res.status(401).json({
        status: "error",
        error: "missing_token",
        message: "QuickBooks not connected or token missing.",
      });
    }

    // ✅ Attach QBO context for downstream services/controllers
    req.qbo = { accessToken, realmId };

    return next();
  } catch (err) {
    console.error("[QBO middleware] Authentication failed:", err.message);
    // Optional: give full detail in development, minimal in production
    const isDev = process.env.NODE_ENV !== "production";
    return res.status(401).json({
      status: "error",
      error: "auth_failed",
      message:
        "QuickBooks authentication failed. Please reconnect your account.",
      detail: isDev ? err.message : undefined,
    });
  }
};
