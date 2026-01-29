const redis = require('redis');

// FIX: Use Environment Variables for ECS, fallback to localhost for dev
const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;

const client = redis.createClient({
  socket: { 
    host: redisHost, 
    port: redisPort 
  },
});

client.on('connect', () => console.log(`✅ Redis connected to ${redisHost}:${redisPort}`));
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
      // Optional: Exit process if Redis is critical
      // process.exit(1); 
    }
  }
}

connectRedis();

module.exports = client;