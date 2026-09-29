const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { getMarketingUserModel } = require("../models/marketingUser");

function getMarketingJwtSecret() {
  return process.env.MARKETING_JWT_SECRET || process.env.JWT_SECRET;
}

function getMarketingJwtExpiresIn() {
  const raw =
    process.env.MARKETING_JWT_EXPIRES_IN ||
    process.env.JWT_EXPIRES_IN ||
    "7d";
  const cleaned = String(raw)
    .trim()
    .replace(/^['"]+/, "")
    .replace(/['";]+$/, "");
  return cleaned || "7d";
}

function formatUserResponse(user) {
  const name = user.name || "";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    initials: initials || "NA",
  };
}

function signMarketingToken(user) {
  const secret = getMarketingJwtSecret();
  if (!secret) {
    throw new Error("Missing MARKETING_JWT_SECRET (or JWT_SECRET fallback).");
  }

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      scope: "marketing",
    },
    secret,
    { expiresIn: getMarketingJwtExpiresIn() },
  );
}

async function findUserByEmail(email) {
  const MarketingUser = getMarketingUserModel();
  return MarketingUser.findOne({ where: { email: email.toLowerCase() } });
}

async function findUserById(id) {
  const MarketingUser = getMarketingUserModel();
  return MarketingUser.findByPk(id);
}

async function validatePassword(user, plainPassword) {
  return bcrypt.compare(plainPassword, user.password_hash);
}

module.exports = {
  formatUserResponse,
  signMarketingToken,
  findUserByEmail,
  findUserById,
  validatePassword,
  getMarketingJwtSecret,
};
