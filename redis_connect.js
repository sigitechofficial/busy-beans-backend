require("dotenv").config();

const redis = require("redis");

function sanitize(value, fallback) {
  const cleaned = String(value ?? fallback)
    .replace(/['";]/g, "")
    .trim();
  return cleaned || fallback;
}

// local.js (laptop) may use REDIS_HOST / REDIS_PORT from .env (e.g. 6397).
// testbb.js / bb.js must keep the previous hardcoded localhost:6379.
// Reading laptop .env values on the VPS is what hung admin login after the last deploy.
const runningLocal = /local\.js$/i.test(process.argv[1] || "");
const port = runningLocal
  ? Number(sanitize(process.env.REDIS_PORT, "6379")) || 6379
  : 6379;
const host = runningLocal
  ? sanitize(process.env.REDIS_HOST, "localhost")
  : "localhost";

console.log(`[redis] connecting to ${host}:${port}${runningLocal ? " (local env)" : " (server default)"}`);

const client = redis.createClient({
  socket: {
    host,
    port,
    connectTimeout: 5000,
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
  },
  disableOfflineQueue: true,
});

client.on("connect", () => console.log("✅ Redis connected"));
client.on("ready", () => console.log("🚀 Redis ready"));
client.on("error", (err) => console.error("❌ Redis error:", err));
client.on("end", () => console.log("🛑 Redis disconnected"));

let isConnected = false;

async function connectRedis() {
  if (!isConnected) {
    try {
      await client.connect();
      isConnected = true;
    } catch (err) {
      console.error("Redis connection failed:", err);
    }
  }
}

connectRedis();

module.exports = client;
