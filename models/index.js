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
// MySQL config from ENV
// ---------------------------------------------
const {
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_HOST,
  DB_PORT = 3306,
} = process.env;

// ---------------------------------------------
// Sequelize instance
// ---------------------------------------------
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',

  logging: false, // set true if you want SQL logs

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
