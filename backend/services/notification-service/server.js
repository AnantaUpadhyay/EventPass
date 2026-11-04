const { app, db, Notification, tick } = require("./src/app");
async function start() {
  await db.connect();
  await Notification.init();
  const server = app.listen(process.env.PORT || 5004, () =>
    console.log("Notification worker ready"),
  );
  const timer = setInterval(tick, 3000);
  tick();
  process.on("SIGTERM", () => {
    clearInterval(timer);
    server.close(() => process.exit(0));
  });
}
start().catch((err) => {
  console.error(err);
  process.exit(1);
});
