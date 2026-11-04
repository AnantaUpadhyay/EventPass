const { app, db, redis } = require("./src/app");
module.exports = require("../../shared/vercel")(app, async () => {
  await Promise.all([
    db.ready() || db.connect(),
    redis.ready() || redis.connect(),
  ]);
  await require("./src/models/user.model").init();
});
