const rateLimit = require("express-rate-limit");

const buildLimiter = (windowMs, max, actionLabel) =>
  rateLimit({
    windowMs,
    max,
    message: {
      status: "fail",
      message: `Too many ${actionLabel} attempts from this IP. Please try again in 15 minutes.`,
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

// 15-minute window for auth endpoints
const authWindowMs = 15 * 60 * 1000;

const signupRateLimiter = buildLimiter(authWindowMs, 5, "signup");
const loginRateLimiter = buildLimiter(authWindowMs, 10, "login");
const forgotPasswordRateLimiter = buildLimiter(
  authWindowMs,
  5,
  "forgot-password",
);

module.exports = {
  signupRateLimiter,
  loginRateLimiter,
  forgotPasswordRateLimiter,
};
