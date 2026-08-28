const jwt = require("jsonwebtoken");
const catchAsync = require("../../utils/catchAsync");
const { getMarketingJwtSecret } = require("../services/auth.service");
const { sendError } = require("../utils/httpResponses");

/**
 * Bearer JWT for /api/admin/* and /api/auth/me (marketing users only).
 * Uses MARKETING_JWT_SECRET — separate from commerce Redis-backed auth.
 */
exports.marketingProtect = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return sendError(res, 401, "Authentication required", "UNAUTHORIZED");
  }

  const token = header.split(" ")[1];
  const secret = getMarketingJwtSecret();
  if (!secret) {
    return sendError(
      res,
      500,
      "Marketing auth secret is not configured.",
      "SERVER_MISCONFIGURATION",
    );
  }

  try {
    const decoded = jwt.verify(token, secret);
    if (decoded.scope && decoded.scope !== "marketing") {
      return sendError(res, 401, "Invalid token scope", "UNAUTHORIZED");
    }
    req.marketingUser = decoded;
    next();
  } catch {
    return sendError(res, 401, "Invalid or expired token", "UNAUTHORIZED");
  }
});
