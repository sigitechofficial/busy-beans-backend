// utils/deleteDeviceToken.js
const { deviceToken } = require('../models'); // adjust path as needed
const REDIS = require('./redisHandling');

async function deleteDeviceTokenMultiple({ entity, tokenCondition, id }) {
  console.log('🚀 ~ deleteDeviceTokenMultiple ~ entity:');
  try {
    await deviceToken.destroy({
      where: tokenCondition,
    });

    REDIS.revokeAllTokensForUser(`${entity}${id}`);
  } catch (error) {
    console.error('Error deleting device token:', error);
  }
}

async function deleteDeviceTokenSingle({
  entity,
  tokenCondition,
  refreshToken,
  id,
}) {
  console.log('🚀 ~ deleteDeviceTokenSingle ~ deleteDeviceTokenSingle:');
  try {
    await deviceToken.destroy({
      where: tokenCondition,
    });
    REDIS.revokeSingleToken(`${entity}${id}`, refreshToken);
  } catch (error) {
    console.error('Error deleting device token:', error);
  }
}
module.exports = { deleteDeviceTokenMultiple, deleteDeviceTokenSingle };
