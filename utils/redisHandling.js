// storeToken.js
 //
const redisClient = require('../redis_connect');
//* Token Storage Logic (Login)
async function storeAccessToken(userId, refreshToken) {
  // Store token as key → userId
  await redisClient.set(`refreshToken:${refreshToken}`, userId, {
    EX: 60 * 60 * 24 * 30, // 30 days
  });
  
  // Track token in user-specific Set
  await redisClient.sAdd(`userTokens:${userId}`, refreshToken);
}
// await storeRefreshToken(user.id, refreshToken);

//*  Validate Token Using Only Token Value
async function getUserIdFromToken(refreshToken) {
  return await redisClient.get(`refreshToken:${refreshToken}`);
}
// const userId = await getUserIdFromToken(token);

//* Logout: Revoke Only One Token
async function revokeSingleToken(userId, refreshToken) {
  await redisClient.del(`refreshToken:${refreshToken}`);
  await redisClient.sRem(`userTokens:${userId}`, refreshToken);
}
// await revokeSingleToken(user.id, refreshToken);

//* Admin Blocks User: Revoke All Tokens

async function revokeAllTokensForUser(userId) {
  const tokens = await redisClient.sMembers(`userTokens:${userId}`);

  for (const token of tokens) {
    await redisClient.del(`refreshToken:${token}`);
  }

  await redisClient.del(`userTokens:${userId}`);
}
// await revokeAllTokensForUser(userId);

//*  All User Tokens (for admin/debug)

async function userAllTokens(userId) {
  const tokens = await redisClient.sMembers(`userTokens:${userId}`);
  console.log(`Tokens for user ${userId}:`, tokens);
  return tokens
}

module.exports = {
 storeAccessToken,
 getUserIdFromToken,
 revokeSingleToken,
 revokeAllTokensForUser,
 userAllTokens,
};
