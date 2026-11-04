const express = require("express");
const { waitUntil } = require("@vercel/functions");
const { serviceFetch } = require("../../shared/http");
const { app, db, redis } = require("./src/app");
const routes = express();
routes.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/api/booking/confirm") {
    waitUntil(
      new Promise((resolve) => res.once("finish", resolve))
        .then(async () => {
          if (res.statusCode < 300 && process.env.NOTIFICATION_URL) {
            await serviceFetch(
              `${process.env.NOTIFICATION_URL}/internal/process`,
              { method: "POST" },
            );
          }
        })
        .catch((error) =>
          console.error("Mail dispatch deferred:", error.message),
        ),
    );
  }
  next();
});
routes.use(app);
module.exports = require("../../shared/vercel")(routes, async () => {
  await Promise.all([
    db.ready() || db.connect(),
    redis.ready() || redis.connect(),
  ]);
  await require("./src/models/booking.model").init();
});
