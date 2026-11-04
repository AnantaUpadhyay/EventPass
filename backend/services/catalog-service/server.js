const { app, db, redis } = require("./src/app");
const Event = require("./src/models/event.model");
async function start() {
  await Promise.all([db.connect(), redis.connect()]);
  await Event.init();
  if (process.env.SEED_DEMO === "true") {
    const seeds = require("./src/data/seedEvents");
    await Event.bulkWrite(
      seeds.map((event) => ({
        updateOne: {
          filter: { _id: event._id },
          update: {
            $setOnInsert: Object.fromEntries(
              Object.entries(event).filter(([key]) => key !== "bannerUrl"),
            ),
            $set: { bannerUrl: event.bannerUrl },
          },
          upsert: true,
        },
      })),
    );
  }
  const server = app.listen(process.env.PORT || 5002, () =>
    console.log("Catalog ready"),
  );
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
}
start().catch((err) => {
  console.error(err);
  process.exit(1);
});
