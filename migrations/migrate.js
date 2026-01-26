require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config/config.json');

// Get environment (development, test, production)
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Create database connection
async function createConnection() {
  let connection;
  
  if (env === 'production' && process.env.DATABASE_URL) {
    // Parse DATABASE_URL for production
    const url = new URL(process.env.DATABASE_URL);
    connection = await mysql.createConnection({
      host: url.hostname,
      port: url.port || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading '/'
      multipleStatements: true,
    });
  } else {
    connection = await mysql.createConnection({
      host: dbConfig.host || '127.0.0.1',
      port: dbConfig.port || 3306,
      user: dbConfig.username || 'root',
      password: dbConfig.password || '',
      database: dbConfig.database,
      multipleStatements: true,
    });
  }
  
  return connection;
}

// Create migrations table if it doesn't exist
async function createMigrationsTable(connection) {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS \`migrations\` (
      \`id\` INT(11) NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(255) NOT NULL,
      \`batch\` INT(11) NOT NULL,
      \`run_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`migrations_name_unique\` (\`name\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  
  await connection.query(createTableSQL);
}

// Get all migration files from migrations directory
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname);
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql') && file !== 'README.md')
    .sort(); // Sort to ensure order
  
  return files.map(file => ({
    name: file,
    path: path.join(migrationsDir, file),
  }));
}

// Check if migration has been run
async function isMigrationRun(connection, migrationName) {
  const [rows] = await connection.query(
    'SELECT * FROM `migrations` WHERE `name` = ?',
    [migrationName]
  );
  return rows.length > 0;
}

// Get the next batch number
async function getNextBatch(connection) {
  const [rows] = await connection.query(
    'SELECT MAX(`batch`) as maxBatch FROM `migrations`'
  );
  return (rows[0]?.maxBatch || 0) + 1;
}

// Record migration as run
async function recordMigration(connection, migrationName, batch) {
  await connection.query(
    'INSERT INTO `migrations` (`name`, `batch`) VALUES (?, ?)',
    [migrationName, batch]
  );
}

// Run a single migration
async function runMigration(connection, migrationFile, migrationName) {
  console.log(`\n📄 Running migration: ${migrationName}`);
  
  try {
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // Split by semicolon and filter out empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      // Skip DESCRIBE and SELECT statements (verification queries)
      if (statement.toUpperCase().startsWith('DESCRIBE') || 
          statement.toUpperCase().startsWith('SELECT')) {
        continue;
      }
      
      try {
        await connection.query(statement);
      } catch (error) {
        // Check if error is about column/constraint already existing
        if (error.code === 'ER_DUP_FIELDNAME' || 
            error.code === 'ER_DUP_KEYNAME' || 
            error.code === 'ER_DUP_ENTRY' ||
            error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
          console.log(`  ⚠️  Warning: ${error.message.split('\n')[0]}`);
          // Continue execution
        } else {
          throw error;
        }
      }
    }
    
    console.log(`  ✅ Migration completed: ${migrationName}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Migration failed: ${migrationName}`);
    console.error(`  Error: ${error.message}`);
    throw error;
  }
}

// Main migration function
async function migrate() {
  const connection = await createConnection();
  
  try {
    console.log(`\n🔧 Running migrations in ${env} environment...`);
    console.log(`📦 Database: ${dbConfig.database || 'from DATABASE_URL'}\n`);
    
    // Create migrations table
    await createMigrationsTable(connection);
    console.log('✅ Migrations table ready\n');
    
    // Get all migration files
    const migrationFiles = getMigrationFiles();
    
    if (migrationFiles.length === 0) {
      console.log('⚠️  No migration files found in migrations directory');
      return;
    }
    
    console.log(`📋 Found ${migrationFiles.length} migration file(s):`);
    migrationFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.name}`);
    });
    console.log('');
    
    // Get next batch number
    const batch = await getNextBatch(connection);
    
    let runCount = 0;
    let skippedCount = 0;
    
    // Run each migration
    for (const migration of migrationFiles) {
      const isRun = await isMigrationRun(connection, migration.name);
      
      if (isRun) {
        console.log(`⏭️  Skipping (already run): ${migration.name}`);
        skippedCount++;
      } else {
        await runMigration(connection, migration.path, migration.name);
        await recordMigration(connection, migration.name, batch);
        runCount++;
      }
    }
    
    console.log(`\n✨ Migration Summary:`);
    console.log(`   ✅ Run: ${runCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📦 Total: ${migrationFiles.length}\n`);
    
  } catch (error) {
    console.error('\n💥 Migration failed with error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Run if called directly
if (require.main === module) {
  migrate();
}

module.exports = { migrate, createConnection };
