require("dotenv").config();

const redis = require("redis");

const port = Number(String(process.env.REDIS_PORT || "6379").replace(/['";]/g, "")) || 6379;
const host = String(process.env.REDIS_HOST || "localhost")
  .replace(/['";]/g, "")
  .trim() || "localhost";

const client = redis.createClient({
  socket: { host, port },
});

client.on('connect', () => console.log('✅ Redis connected'));
client.on('ready', () => console.log('🚀 Redis ready'));
client.on('error', (err) => console.error('❌ Redis error:', err));
client.on('end', () => console.log('🛑 Redis disconnected'));

let isConnected = false;

async function connectRedis() {
  if (!isConnected) {
    try {
      await client.connect();
      isConnected = true;
    } catch (err) {
      console.error('Redis connection failed:', err);
    }
  }
}

connectRedis(); // <- async call inside function

module.exports = client;
