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

// Read and execute SQL file
async function runMigration(migrationFile) {
  const connection = await createConnection();
  
  try {
    console.log(`\n📄 Reading migration file: ${migrationFile}`);
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log(`🚀 Executing migration...`);
    await connection.query(sql);
    
    console.log(`✅ Migration completed successfully!\n`);
  } catch (error) {
    console.error(`❌ Migration failed:`, error.message);
    
    // Check if error is about column/constraint already existing
    if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_DUP_ENTRY') {
      console.log(`⚠️  Warning: Some fields or constraints may already exist. This is usually safe to ignore.\n`);
    } else {
      throw error;
    }
  } finally {
    await connection.end();
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node migrations/run-migration.js <migration-file.sql>');
    console.log('Example: node migrations/run-migration.js migrations/001_add_employee_commission_fields.sql');
    process.exit(1);
  }
  
  const migrationFile = args[0];
  
  // Check if file exists
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Migration file not found: ${migrationFile}`);
    process.exit(1);
  }
  
  // Check if it's a SQL file
  if (!migrationFile.endsWith('.sql')) {
    console.error(`❌ File must be a .sql file: ${migrationFile}`);
    process.exit(1);
  }
  
  console.log(`\n🔧 Running migration in ${env} environment...`);
  console.log(`📦 Database: ${dbConfig.database || 'from DATABASE_URL'}`);
  
  try {
    await runMigration(migrationFile);
    console.log('✨ All done!\n');
  } catch (error) {
    console.error('\n💥 Migration failed with error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runMigration, createConnection };
