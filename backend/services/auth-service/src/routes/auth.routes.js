const router = require("express").Router();
const { asyncRoute, auth, admin, fail } = require("../../../../shared/http");
const controller = require("../controllers/auth.controller");
// Redis rate limits coordinate across replicas and expire automatically.
const redis = require("../../../../shared/redis")(require("redis"));
router.use(
  asyncRoute(async (req, res, next) => {
    if (!redis.ready())
      throw fail(503, "Authentication rate limiter is unavailable.");
    const key = `auth:limit:${req.ip}`;
    const count = await redis.client.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
      { keys: [key], arguments: [] },
    );
    if (count > 60) {
      res.set("Retry-After", "60");
      throw fail(429, "Too many attempts. Try again in a minute.");
    }
    next();
  }),
);
router.post("/session", asyncRoute(controller.session));
router.post("/logout", asyncRoute(controller.logout));
router.post("/register", asyncRoute(controller.register));
router.post("/login", asyncRoute(controller.login));
router.get("/me", auth, asyncRoute(controller.me));
router.patch("/me/preferences", auth, asyncRoute(controller.preferences));
router.post("/organizer-requests", auth, asyncRoute(controller.requestOrganizer));
router.get("/organizer-requests", auth, admin, asyncRoute(controller.organizerRequests));
router.patch("/organizer-requests/:id/approve", auth, admin, asyncRoute(controller.approveOrganizer));
module.exports = { router, redis };
