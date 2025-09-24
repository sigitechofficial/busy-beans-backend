// middleware/qboConnected.js
const { QboToken } = require('../models');

module.exports = async (_req, res, next) => {
  const row = await QboToken.findOne();
  if (!row) {
    return res.status(428).json({
      error: 'QuickBooks not connected. Visit /qbo/auth/login first.',
    });
  }
  next();
};
