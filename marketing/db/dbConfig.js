const path = require("path");

require("dotenv").config();

/**
 * Commerce DB settings from config/config.json (same source as models/index.js).
 */
function getCommerceDbConfig() {
  const env = process.env.NODE_ENV || "development";
  const configPath = path.join(__dirname, "../../config/config.json");
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const config = require(configPath)[env];

  if (env === "production" && process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
    };
  }

  return {
    host: config.host || "127.0.0.1",
    port: Number(config.port || 3306),
    username: config.username,
    password: config.password ?? "",
    database: config.database,
  };
}

/**
 * Marketing uses the same MySQL database as commerce by default.
 * Override with MARKETING_DB_* only when you need a different target.
 */
function getMarketingDbConfig() {
  const commerce = getCommerceDbConfig();

  const username =
    process.env.MARKETING_DB_USER ||
    process.env.DB_USER ||
    commerce.username;
  const password =
    process.env.MARKETING_DB_PASSWORD ??
    process.env.DB_PASSWORD ??
    commerce.password;

  return {
    host:
      process.env.MARKETING_DB_HOST ||
      process.env.DB_HOST ||
      commerce.host,
    port: Number(
      process.env.MARKETING_DB_PORT ||
        process.env.DB_PORT ||
        commerce.port,
    ),
    username,
    password,
    database: process.env.MARKETING_DB_NAME || commerce.database,
  };
}

module.exports = {
  getCommerceDbConfig,
  getMarketingDbConfig,
};
