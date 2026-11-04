const { app, db, redis, Link } = require('./src/app');
async function start() {
  await Promise.all([db.connect(), redis.connect()]); await Link.init();
  const server = app.listen(process.env.PORT || 5005, () => console.log(`Shortener ${process.env.INSTANCE_ID} ready`));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}
start().catch(err => { console.error(err); process.exit(1); });
