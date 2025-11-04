// utils/dbLock.js
// MySQL advisory lock for cross-instance/device mutual exclusion
const { sequelize } = require('../models');

async function withDbLock(lockName, timeoutSec, fn) {
  // Wait for lock (returns 1 on success)
  await sequelize.query('SELECT GET_LOCK(?, ?)', {
    replacements: [lockName, timeoutSec],
  });
  try {
    return await fn();
  } finally {
    await sequelize.query('DO RELEASE_LOCK(?)', { replacements: [lockName] });
  }
}

module.exports = { withDbLock };
