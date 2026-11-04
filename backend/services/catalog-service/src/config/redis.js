const connection = require("../../../../shared/redis")(require("redis"));
const metrics = { cacheHits: 0, cacheMisses: 0 };
module.exports = {
  ...connection,
  getCache: async (key) => {
    if (!connection.ready()) {
      metrics.cacheMisses++;
      return null;
    }
    const value = await connection.client.get(key);
    metrics[value ? "cacheHits" : "cacheMisses"]++;
    return value ? JSON.parse(value) : null;
  },
  setCache: async (key, value, ttl = 3600) => {
    if (connection.ready())
      await connection.client.setEx(key, ttl, JSON.stringify(value));
  },
  invalidate: async () => {
    if (connection.ready()) await connection.client.incr("catalog:version");
  },
  getMetrics: () => metrics,
};
