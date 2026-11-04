const express = require("express");
const { app, db, Notification, tick } = require("./src/app");
const { internal, asyncRoute } = require("../../shared/http");
const routes = express();
routes.post(
  "/internal/process",
  internal,
  asyncRoute(async (req, res) => {
    await tick();
    res.json({ processed: true });
  }),
);
routes.get(
  "/api/notifications/cron",
  (req, res, next) => {
    if (
      !process.env.CRON_SECRET ||
      req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
    )
      return res.sendStatus(401);
    next();
  },
  asyncRoute(async (req, res) => {
    await tick();
    res.json({ processed: true });
  }),
);
routes.use(app);
module.exports = require("../../shared/vercel")(routes, async () => {
  await db.connect();
  await Notification.init();
});
