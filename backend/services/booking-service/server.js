const { app, db, redis } = require("./src/app");
async function start() {
  await Promise.all([db.connect(), redis.connect()]);
  await require("./src/models/booking.model").init();
  const server = app.listen(process.env.PORT || 5003, () =>
    console.log("Booking ready"),
  );
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
}
start().catch((err) => {
  console.error(err);
  process.exit(1);
});
