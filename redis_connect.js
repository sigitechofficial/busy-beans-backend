const redis = require('redis');


(async () => {
  const client = redis.createClient({
    socket: { host: 'localhost', port: 6379 },
  });

  client.on('connect', () => console.log('Redis connected'));
  client.on('ready', () => console.log('Redis ready'));
  client.on('error', (err) => console.error('Redis error:', err));
  client.on('end', () => console.log('Redis disconnected'));

  try {
    await client.connect();
  } catch (err) {
    console.error('Connection failed:', err);
  }
})();
