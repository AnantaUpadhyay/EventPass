const { createHash, randomUUID } = require("node:crypto");
const cache = require("../config/redis");
const { fail } = require("../../../../shared/http");
const { cities, categories, searchEvents } = require("../services/discovery");
const BUDGET = `
if redis.call('EXISTS',KEYS[3])==1 then return 2 end
if tonumber(redis.call('GET',KEYS[1]) or '0')>=5 or tonumber(redis.call('GET',KEYS[2]) or '0')>=tonumber(ARGV[2]) then return 0 end
redis.call('SET',KEYS[3],ARGV[1],'EX',70)
redis.call('INCR',KEYS[1]); redis.call('EXPIRE',KEYS[1],120)
redis.call('INCR',KEYS[2]); redis.call('EXPIRE',KEYS[2],172800)
return 1`;
exports.options = (req, res) =>
  res.json({
    cities,
    categories,
    enabled: Boolean(process.env.GEMINI_API_KEY),
  });
exports.search = async (req, res) => {
  const { city, category = "All", q = "" } = req.query;
  if (
    !cities.includes(city) ||
    !categories.includes(category) ||
    typeof q !== "string" ||
    q.length > 100 ||
    /[\u0000-\u001f]/.test(q)
  )
    throw fail(
      400,
      "Choose a supported city and enter a search of up to 100 characters.",
    );
  const query = q.trim();
  if (!cache.ready())
    throw fail(503, "Live event search is temporarily unavailable.");
  const hash = createHash("sha256")
    .update(JSON.stringify([city, category, query.toLowerCase()]))
    .digest("hex");
  const key = `discovery:results:${hash}`;
  const hit = await cache.getCache(key);
  if (hit)
    return res
      .set("Cache-Control", "private, no-store")
      .json({ ...hit, cached: true });
  if (!process.env.GEMINI_API_KEY)
    throw fail(
      503,
      "City discovery is not available yet. Please try again later.",
    );
  const owner = randomUUID(),
    lock = `discovery:{budget}:lock:${hash}`,
    now = Date.now();
  const limit = Math.min(
    1000,
    Math.max(1, Number(process.env.DISCOVERY_DAILY_LIMIT) || 30),
  );
  const budget = await cache.client.eval(BUDGET, {
    keys: [
      `discovery:{budget}:minute:${req.user.id}:${Math.floor(now / 60000)}`,
      `discovery:{budget}:daily:${new Date(now).toISOString().slice(0, 10)}`,
      lock,
    ],
    arguments: [owner, String(limit)],
  });
  if (budget === 2)
    throw fail(
      409,
      "This search is already running. Please try again shortly.",
    );
  if (budget !== 1)
    throw fail(
      429,
      "Live search has reached its limit. Please try again later.",
    );
  try {
    const result = await searchEvents(
      { city, query, category },
      { apiKey: process.env.GEMINI_API_KEY },
    );
    await cache.setCache(key, result, 900);
    res
      .set("Cache-Control", "private, no-store")
      .json({ ...result, cached: false });
  } finally {
    await cache.client
      .eval(
        "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",
        { keys: [lock], arguments: [owner] },
      )
      .catch(() => {});
  }
};
