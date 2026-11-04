const { createApp, errors } = require("../../../shared/http");
const db = require("./config/db");
const { router, redis } = require("./routes/auth.routes");
const app = createApp("auth-service", () => ({
  mongo: db.ready(),
  redis: redis.ready(),
}));
app.use("/api/auth", router);
module.exports = { app: errors(app), redis, db };
