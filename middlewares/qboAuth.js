// middleware/qboAuth.js
const { refreshAccessTokenIfNeeded } = require("../services/qboTokenService");

module.exports = async function qboAuth(req, res, next) {
  try {
    // Get a valid token (refreshes if expired)
    const { accessToken, realmId } = await refreshAccessTokenIfNeeded();

    if (!accessToken || !realmId) {
      return res.status(401).json({
        status: "error",
        error: "missing_token",
        message: "QuickBooks not connected or token missing.",
      });
    }

    // Attach token context to request for controllers
    req.qbo = { accessToken, realmId };
    next();
  } catch (err) {
    console.error("[QBO middleware] failed:", err);
    return res.status(401).json({
      status: "error",
      error: "auth_failed2",
      message: "QuickBooks authentication failed. Please reconnect.",
      detail: err.message,
    });
  }
};
