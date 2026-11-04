const { app, db, redis } = require('./src/app');
const User = require('./src/models/user.model');
async function start() {
  await Promise.all([db.connect(), redis.connect()]);
  await User.init();
  if (process.env.SEED_DEMO === 'true') {
    const bcrypt = require('bcryptjs');
    for (const [email, name, role] of [['student@college.edu', 'Aarav Sharma', 'student'], ['organizer@college.edu', 'EventPass Studio', 'admin']]) {
      await User.updateOne({ email }, { $setOnInsert: { name, email, role, passwordHash: await bcrypt.hash(process.env.DEMO_PASSWORD || 'student123', 12) } }, { upsert: true });
    }
  }
  const server = app.listen(process.env.PORT || 5001, () => console.log('Auth ready'));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}
start().catch(err => { console.error(err); process.exit(1); });
