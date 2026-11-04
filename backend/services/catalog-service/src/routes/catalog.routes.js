const router = require("express").Router();
const { asyncRoute, auth, admin } = require("../../../../shared/http");
const controller = require("../controllers/catalog.controller");
const cache = require("../config/redis");
router.get("/metrics", (req, res) => res.json(cache.getMetrics()));
router.get("/events", asyncRoute(controller.getAllEvents));
router.get("/events/:id", asyncRoute(controller.getEventById));
router.post("/events", auth, admin, asyncRoute(controller.createEvent));
module.exports = router;
