const crypto = require("crypto");
const AppError = require("../utils/appError");
const { protect, STAFF_ENTITIES } = require("./protect");

let warned = false;

function keyMatches(given, expected) {
  const a = Buffer.from(String(given || ""));
  const b = Buffer.from(String(expected || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled-job / internal endpoints: allowed with the `x-job-key` header (INTERNAL_JOB_API_KEY)
 * or a staff token (the admin panel triggers some of them manually).
 *
 * Until INTERNAL_JOB_API_KEY is set, requests without either are still allowed with a warning, so
 * existing Lambda callers keep working; set the key in the API env and in each caller to enforce.
 */
exports.jobKeyOrStaff = (req, res, next) => {
  const expected = process.env.INTERNAL_JOB_API_KEY;
  const given = req.headers["x-job-key"];
  if (expected && given && keyMatches(given, expected)) return next();

  const hasToken =
    (req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")) ||
    (req.cookies && req.cookies.jwt);
  if (hasToken) {
    return protect(req, res, (error) => {
      if (error) return next(error);
      if (!STAFF_ENTITIES.includes(req.user?.entity)) {
        return next(new AppError("You do not have permission to perform this action", 403));
      }
      next();
    });
  }

  if (!expected) {
    if (!warned) {
      warned = true;
      console.warn(
        "[job-key] INTERNAL_JOB_API_KEY is not set: job endpoints accept unauthenticated calls. Set it to enforce.",
      );
    }
    return next();
  }
  return next(new AppError("Missing or invalid job key.", 401, "authentication-fail"));
};
