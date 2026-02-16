const redis = require('redis');

// MODIFIED: ECS mein humne REDIS_URL set kiya tha, usay pehle check karein.
// Agar nahi milta (Local development ke liye), toh default localhost use karein.
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const client = redis.createClient({
  url: redisUrl
  // Note: 'socket' object ki zaroorat nahi jab hum 'url' use karte hain
});

client.on('connect', () => console.log(`✅ Redis connecting to ${redisUrl}`));
client.on('ready', () => console.log('🚀 Redis ready and serving!'));
client.on('error', (err) => console.error('❌ Redis error:', err));
client.on('end', () => console.log('🛑 Redis disconnected'));

let isConnected = false;

async function connectRedis() {
  if (!isConnected) {
    try {
      await client.connect();
      isConnected = true;
      console.log("🔒 Connection established successfully.");
    } catch (err) {
      console.error('Redis connection failed:', err);
      // Optional: Retry logic could go here
    }
  }
}

connectRedis();

module.exports = client;