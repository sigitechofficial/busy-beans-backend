const { Sequelize } = require("sequelize");
const { getMarketingDbConfig } = require("./dbConfig");

let sequelize = null;

/**
 * Sequelize instance for marketing tables.
 * Uses the same MySQL database as commerce by default (see dbConfig.js).
 * Does not load commerce models from models/index.js.
 */
function getMarketingSequelize() {
  if (sequelize) return sequelize;

  const { database, username, password, host, port } = getMarketingDbConfig();

  if (!username || password === undefined || password === null) {
    throw new Error(
      "Marketing DB credentials missing. Set DB user/password in config/config.json or MARKETING_DB_USER/MARKETING_DB_PASSWORD.",
    );
  }

  if (!database) {
    throw new Error(
      "Marketing database name missing. Set database in config/config.json or MARKETING_DB_NAME.",
    );
  }

  sequelize = new Sequelize(database, username, password, {
    host,
    port,
    dialect: "mysql",
    logging:
      process.env.MARKETING_DB_LOGGING === "true"
        ? console.log
        : false,
    define: {
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  });

  return sequelize;
}

async function testMarketingConnection() {
  const db = getMarketingSequelize();
  await db.authenticate();
  return true;
}

module.exports = {
  getMarketingSequelize,
  testMarketingConnection,
  getMarketingDbConfig,
};
