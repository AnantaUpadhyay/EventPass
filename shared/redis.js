module.exports = function redisConnection(redis) {
  const client = redis.createClient({ url: process.env.REDIS_URL || 'redis://127.0.0.1:6379', socket: { connectTimeout: 3000, reconnectStrategy: retries => Math.min(200 * retries, 3000) }, disableOfflineQueue: true });
  client.on('error', err => console.error('[Redis]', err.message));
  return { client, ready: () => client.isReady, connect: () => client.connect() };
};
