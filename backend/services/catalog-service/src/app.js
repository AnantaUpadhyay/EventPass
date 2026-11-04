const { createApp, errors } = require("../../../shared/http");
const db = require("./config/db");
const redis = require("./config/redis");
const app = createApp("catalog-service", () => ({
  mongo: db.ready(),
  redis: redis.ready(),
}));
app.use("/api/catalog", require("./routes/catalog.routes"));
module.exports = { app: errors(app), db, redis };
