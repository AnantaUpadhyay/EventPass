const { app, db, redis } = require("./src/app");
const Event = require("./src/models/event.model");
module.exports = require("../../shared/vercel")(app, async () => {
  await Promise.all([
    db.ready() || db.connect(),
    redis.ready() || redis.connect(),
  ]);
  await Event.init();
  if (process.env.SEED_CATALOG === "true") {
    await Event.bulkWrite(
      require("./src/data/seedEvents").map((event) => ({
        updateOne: {
          filter: { _id: event._id },
          update: { $setOnInsert: event },
          upsert: true,
        },
      })),
    );
  }
});
