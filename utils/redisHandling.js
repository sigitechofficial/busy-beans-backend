const redisClient = require("../redis_connect"); // This returns the client instance

const LOGIN_REDIS_TIMEOUT_MS = 2500;

async function withLoginRedisTimeout(promise, fallback) {
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Redis login helper timed out")),
          LOGIN_REDIS_TIMEOUT_MS,
        ),
      ),
    ]);
  } catch (err) {
    console.error("[redis] login helper skipped:", err.message);
    return fallback;
  }
}

//* Token Storage Logic (Login)
async function storeAccessToken(userId, refreshToken) {
  console.log("🚀 ~ Tokenn saved in REDIS:");

  await withLoginRedisTimeout(
    redisClient.set(`${refreshToken}`, userId, {
      EX: 60 * 60 * 24 * 7, // 7 days
    }),
    undefined,
  );

  await withLoginRedisTimeout(redisClient.sAdd(`${userId}`, refreshToken), undefined);
}
// await storeRefreshToken(user.id, refreshToken);

//*  Validate Token Using Only Token Value
async function getUserIdFromToken(refreshToken) {
  console.log("🚀 ~ getUserIdFromToken REDIS:");

  return await redisClient.get(`${refreshToken}`);
}
// const userId = await getUserIdFromToken(token);

//* Logout: Revoke Only One Token
async function revokeSingleToken(userId, refreshToken) {
  console.log("🚀 ~ revokeSingleToken REDIS:");
  await redisClient.del(`${refreshToken}`);
  await redisClient.sRem(`${userId}`, refreshToken);
}
// await revokeSingleToken(user.id, refreshToken);

//* Admin Blocks User: Revoke All Tokens

async function revokeAllTokensForUser(userId) {
  console.log("🚀 ~ revokeAllTokensForUser REDIS:");
  const tokens = await redisClient.sMembers(`${userId}`);

  for (const token of tokens) {
    await redisClient.del(`${token}`);
  }

  await redisClient.del(`${userId}`);
}
// await revokeAllTokensForUser(userId);

//*  All User Tokens (for admin/debug)

async function userAllTokens(userId) {
  console.log("🚀 ~ userAllTokens REDIS:");
  const tokens = await redisClient.sMembers(`${userId}`);
  console.log(`Tokens for user ${userId}:`, tokens);
  return tokens;
}

// Login failed-attempt tracking per account identity (entity + id)
const LOGIN_FAILED_WINDOW_SEC = 15 * 60;
const LOGIN_FAILED_MAX_ATTEMPTS = 5;

function loginFailedKey(entity, id) {
  return `login_failed:${entity}:${id}`;
}

async function getLoginFailedAttempts(entity, id) {
  const key = loginFailedKey(entity, id);
  const val = await withLoginRedisTimeout(redisClient.get(key), null);
  return val ? parseInt(val, 10) : 0;
}

async function incrementLoginFailedAttempts(entity, id) {
  const key = loginFailedKey(entity, id);
  const count = await withLoginRedisTimeout(redisClient.incr(key), 1);
  const ttl = await withLoginRedisTimeout(redisClient.ttl(key), -2);
  if (ttl === -1) {
    await withLoginRedisTimeout(
      redisClient.expire(key, LOGIN_FAILED_WINDOW_SEC),
      undefined,
    );
  }
  return count;
}

async function resetLoginFailedAttempts(entity, id) {
  const key = loginFailedKey(entity, id);
  await withLoginRedisTimeout(redisClient.del(key), undefined);
}

module.exports = {
  storeAccessToken,
  getUserIdFromToken,
  revokeSingleToken,
  revokeAllTokensForUser,
  userAllTokens,
  getLoginFailedAttempts,
  incrementLoginFailedAttempts,
  resetLoginFailedAttempts,
  LOGIN_FAILED_MAX_ATTEMPTS,
};
