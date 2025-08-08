const redis = require('redis');

const client = redis.createClient({
  socket: { host: 'localhost', port: 6379 },
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
