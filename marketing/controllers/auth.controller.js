const bcrypt = require("bcryptjs");
const catchAsync = require("../../utils/catchAsync");
const { getMarketingUserModel } = require("../models/marketingUser");
const {
  formatUserResponse,
  signMarketingToken,
  findUserByEmail,
  findUserById,
  validatePassword,
} = require("../services/auth.service");
const { sendData, sendError } = require("../utils/httpResponses");

exports.login = catchAsync(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return sendError(res, 400, "Email and password are required.", "VALIDATION_ERROR");
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return sendError(res, 401, "Invalid credentials.", "INVALID_CREDENTIALS");
  }

  const isValid = await validatePassword(user, password);
  if (!isValid) {
    return sendError(res, 401, "Invalid credentials.", "INVALID_CREDENTIALS");
  }

  const token = signMarketingToken(user);
  return sendData(res, 200, {
    token,
    user: formatUserResponse(user),
  });
});

exports.me = catchAsync(async (req, res) => {
  const userId = req.marketingUser?.sub;
  if (!userId) {
    return sendError(res, 401, "Invalid token payload.", "UNAUTHORIZED");
  }

  const user = await findUserById(userId);
  if (!user) {
    return sendError(res, 401, "User not found for token.", "UNAUTHORIZED");
  }

  return sendData(res, 200, formatUserResponse(user));
});

exports.logout = catchAsync(async (_req, res) => {
  return res.status(204).send();
});

exports.updateProfile = catchAsync(async (req, res) => {
  const userId = req.marketingUser?.sub;
  const name = String(req.body?.name || "").trim();

  if (!name) {
    return sendError(res, 400, "Name is required.", "VALIDATION_ERROR");
  }

  const MarketingUser = getMarketingUserModel();
  const user = await MarketingUser.findByPk(userId);
  if (!user) {
    return sendError(res, 404, "User not found.", "NOT_FOUND");
  }

  user.name = name;
  await user.save();

  return sendData(res, 200, formatUserResponse(user));
});

exports.changePassword = catchAsync(async (req, res) => {
  const userId = req.marketingUser?.sub;
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  if (!currentPassword || !newPassword) {
    return sendError(
      res,
      400,
      "currentPassword and newPassword are required.",
      "VALIDATION_ERROR",
    );
  }

  if (newPassword.length < 6) {
    return sendError(res, 400, "New password must be at least 6 characters.", "WEAK_PASSWORD");
  }

  if (currentPassword === newPassword) {
    return sendError(
      res,
      400,
      "New password must differ from current password.",
      "PASSWORD_UNCHANGED",
    );
  }

  const MarketingUser = getMarketingUserModel();
  const user = await MarketingUser.findByPk(userId);
  if (!user) {
    return sendError(res, 404, "User not found.", "NOT_FOUND");
  }

  const matches = await validatePassword(user, currentPassword);
  if (!matches) {
    return sendError(
      res,
      400,
      "Current password is incorrect.",
      "INVALID_CURRENT_PASSWORD",
    );
  }

  user.password_hash = await bcrypt.hash(newPassword, 12);
  await user.save();

  return sendData(res, 200, { ok: true });
});
