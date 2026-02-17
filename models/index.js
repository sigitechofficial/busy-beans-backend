/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');

const basename = path.basename(__filename);
const db = {};

// ---------------------------------------------
// MySQL config from ENV (Standard Names)
// ---------------------------------------------
const {
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_HOST,
  DB_PORT,
} = process.env;

// ---------------------------------------------
// Sequelize instance
// ---------------------------------------------
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT || 3306, // Default to 3306 if not provided
  dialect: 'mysql',

  logging: false, // Set to true if you want to see SQL queries in logs

  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// ---------------------------------------------
// Load models
// ---------------------------------------------
fs.readdirSync(__dirname)
  .filter(
    (file) =>
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js'
  )
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes
    );
    db[model.name] = model;
  });

// ---------------------------------------------
// Associations
// ---------------------------------------------
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// ---------------------------------------------
// Export
// ---------------------------------------------
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;