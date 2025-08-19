const redisClient = require('../redis_connect'); // This returns the client instance

//* Token Storage Logic (Login)
async function storeAccessToken(userId, refreshToken) {
  console.log('🚀 ~ Tokenn saved in REDIS:');

  await redisClient.set(`${refreshToken}`, userId, {
    EX: 60 * 60 * 24 * 7, // 7 days
  });

  // Track token in user-specific Set
  await redisClient.sAdd(`${userId}`, refreshToken);
}
// await storeRefreshToken(user.id, refreshToken);

//*  Validate Token Using Only Token Value
async function getUserIdFromToken(refreshToken) {
  console.log('🚀 ~ getUserIdFromToken REDIS:');

  return await redisClient.get(`${refreshToken}`);
}
// const userId = await getUserIdFromToken(token);

//* Logout: Revoke Only One Token
async function revokeSingleToken(userId, refreshToken) {
  console.log('🚀 ~ revokeSingleToken REDIS:');
  await redisClient.del(`${refreshToken}`);
  await redisClient.sRem(`${userId}`, refreshToken);
}
// await revokeSingleToken(user.id, refreshToken);

//* Admin Blocks User: Revoke All Tokens

async function revokeAllTokensForUser(userId) {
  console.log('🚀 ~ revokeAllTokensForUser REDIS:');
  const tokens = await redisClient.sMembers(`${userId}`);

  for (const token of tokens) {
    await redisClient.del(`${token}`);
  }

  await redisClient.del(`${userId}`);
}
// await revokeAllTokensForUser(userId);

//*  All User Tokens (for admin/debug)

async function userAllTokens(userId) {
  console.log('🚀 ~ userAllTokens REDIS:');
  const tokens = await redisClient.sMembers(`${userId}`);
  console.log(`Tokens for user ${userId}:`, tokens);
  return tokens;
}

module.exports = {
  storeAccessToken,
  getUserIdFromToken,
  revokeSingleToken,
  revokeAllTokensForUser,
  userAllTokens,
};
