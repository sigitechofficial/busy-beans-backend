require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { getMarketingDbConfig } = require("../db/dbConfig");

function createConnection() {
  const { host, port, username, password, database } = getMarketingDbConfig();

  if (!username || password === undefined || password === null) {
    throw new Error(
      "Missing DB credentials. Configure config/config.json or MARKETING_DB_USER/MARKETING_DB_PASSWORD.",
    );
  }

  if (!database) {
    throw new Error(
      "Missing database name. Configure config/config.json or MARKETING_DB_NAME.",
    );
  }

  return mysql.createConnection({
    host,
    port,
    user: username,
    password,
    database,
    multipleStatements: true,
  });
}

async function createMigrationsTable(connection) {
  const sql = `
    CREATE TABLE IF NOT EXISTS \`marketing_migrations\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(255) NOT NULL,
      \`batch\` INT NOT NULL,
      \`run_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`marketing_migrations_name_unique\` (\`name\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await connection.query(sql);
}

function getMigrationFiles() {
  return fs
    .readdirSync(__dirname)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

async function isMigrationRun(connection, name) {
  const [rows] = await connection.query(
    "SELECT id FROM `marketing_migrations` WHERE `name` = ?",
    [name],
  );
  return rows.length > 0;
}

async function getNextBatch(connection) {
  const [rows] = await connection.query(
    "SELECT MAX(`batch`) AS maxBatch FROM `marketing_migrations`",
  );
  return (rows[0]?.maxBatch || 0) + 1;
}

async function runMigration(connection, filename) {
  const sql = fs.readFileSync(path.join(__dirname, filename), "utf8");
  await connection.query(sql);
}

async function migrate() {
  const { database } = getMarketingDbConfig();
  // eslint-disable-next-line no-console
  console.log(`Marketing migrations target database: ${database}`);

  const connection = await createConnection();
  try {
    await createMigrationsTable(connection);
    const files = getMigrationFiles();
    const batch = await getNextBatch(connection);

    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      const alreadyRun = await isMigrationRun(connection, file);
      if (alreadyRun) {
        // eslint-disable-next-line no-console
        console.log(`Skipping already-run migration: ${file}`);
        // eslint-disable-next-line no-continue
        continue;
      }

      // eslint-disable-next-line no-console
      console.log(`Running migration: ${file}`);
      // eslint-disable-next-line no-await-in-loop
      await runMigration(connection, file);
      // eslint-disable-next-line no-await-in-loop
      await connection.query(
        "INSERT INTO `marketing_migrations` (`name`, `batch`) VALUES (?, ?)",
        [file, batch],
      );
    }
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  migrate()
    // eslint-disable-next-line no-console
    .then(() => console.log("Marketing migrations completed."))
    // eslint-disable-next-line no-console
    .catch((error) => {
      console.error("Marketing migrations failed:", error.message);
      process.exit(1);
    });
}

module.exports = { migrate, getMarketingDbConfig };
