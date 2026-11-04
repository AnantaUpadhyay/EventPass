const router = require("express").Router();
const { asyncRoute, auth } = require("../../../../shared/http");
const controller = require("../controllers/catalog.controller");
const campus = require("../controllers/campus.controller");
const reviews = require("../controllers/reviews.controller");
const cache = require("../config/redis");
const discovery = require("../controllers/discovery.controller");
router.get("/universities", campus.options);
router.get("/campus/events", asyncRoute(campus.list));
router.get("/events/:id/reviews", asyncRoute(reviews.list));
router.put("/events/:id/reviews", auth, asyncRoute(reviews.save));
router.delete("/events/:id/reviews", auth, asyncRoute(reviews.remove));
router.get("/discovery/options", discovery.options);
router.get("/discovery", auth, asyncRoute(discovery.search));
router.get("/metrics", (req, res) => res.json(cache.getMetrics()));
router.get("/events", asyncRoute(controller.getAllEvents));
router.get("/events/:id", asyncRoute(controller.getEventById));
router.post("/events", auth, (req, res, next) => {
  if (!["admin", "organizer"].includes(req.user.role))
    return res.status(403).json({ error: "University publishing requires organizer approval." });
  next();
}, asyncRoute(controller.createEvent));
module.exports = router;
