const catchAsync = require("../../utils/catchAsync");
const ssoService = require("../services/sso.service");
const { sendData, sendError } = require("../utils/httpResponses");

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

/** POST /api/v1/admin/marketing-sso/code — commerce admin session (protect) required. */
exports.issue = catchAsync(async (req, res) => {
  // Main admin accounts only: sub-admins and employees do not get Campaign Builder access.
  if (req.user?.entity !== "admin") {
    return sendError(res, 403, "Only admins can open the Campaign Builder.", "SSO_FORBIDDEN");
  }
  const data = await ssoService.issueCode({
    adminEntity: req.user.entity,
    adminId: req.user.id,
    email: req.user.email,
    ip: clientIp(req),
  });
  res.set("Cache-Control", "no-store");
  return sendData(res, 201, data);
});

/** POST /api/auth/sso/exchange { code } — public; the single-use code is the credential. */
exports.exchange = catchAsync(async (req, res) => {
  try {
    const data = await ssoService.exchangeCode({
      code: req.body?.code,
      ip: clientIp(req),
      userAgent: req.headers["user-agent"],
    });
    res.set("Cache-Control", "no-store");
    return sendData(res, 200, data);
  } catch (error) {
    if (error.code && error.code.startsWith("SSO_")) {
      return sendError(res, error.status || 400, error.message, error.code);
    }
    throw error;
  }
});
