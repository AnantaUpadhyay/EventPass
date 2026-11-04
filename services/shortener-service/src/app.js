const mongoose = require('mongoose');
const { randomBytes } = require('node:crypto');
const { createApp, errors, auth, asyncRoute, fail } = require('../../../shared/http');
const { destination } = require('../../../shared/validation');
const db = require('../../../shared/database')(mongoose, 'links');
const redis = require('../../../shared/redis')(require('redis'));
const Link = mongoose.model('Link', new mongoose.Schema({
  code: { type: String, unique: true, required: true },
  userId: { type: String, index: true, required: true },
  url: { type: String, required: true, maxlength: 2048 },
  title: { type: String, maxlength: 100, default: '' },
  clicks: { type: Number, default: 0 },
  lastClickedAt: Date,
  expiresAt: { type: Date, default: null }
}, { timestamps: true }));
const app = createApp('shortener-service', () => ({ mongo: db.ready(), redis: redis.ready() }));
const view = link => ({ ...link.toObject(), shortPath: `/r/${link.code}`, instance: process.env.INSTANCE_ID });
function expiration(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date <= new Date()) throw fail(400, 'Expiration must be a future date.');
  return date;
}
app.get('/api/links/instance', (req, res) => res.json({ instance: process.env.INSTANCE_ID || 'shortener', strategy: 'round-robin', database: 'shared MongoDB' }));
app.get('/r/:code', asyncRoute(async (req, res) => {
  const link = await Link.findOneAndUpdate({ code: req.params.code, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }, { $inc: { clicks: 1 }, $set: { lastClickedAt: new Date() } }, { new: true });
  res.set('Cache-Control', 'no-store');
  if (!link) return res.status(404).type('html').send('<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Link unavailable · EventPass</title></head><body style="font-family:system-ui;background:#f5f3ef;padding:12vw;color:#211d28"><p>EVENTPASS / LINKS</p><h1>This link has left the building.</h1><p>It may have expired or been removed.</p><a href="/">Back to EventPass</a></body></html>');
  res.redirect(302, link.url);
}));
app.use('/api/links', auth);
app.get('/api/links', asyncRoute(async (req, res) => {
  const links = await Link.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100);
  res.json({ links: links.map(view) });
}));
app.post('/api/links', asyncRoute(async (req, res) => {
  if (!redis.ready()) throw fail(503, 'Link creation is temporarily unavailable.');
  const count = await redis.client.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n", { keys: [`links:limit:${req.user.id}`], arguments: [] });
  if (count > 30) throw fail(429, 'Create at most 30 links per minute.');
  const { url, alias, title = '', expiresAt } = req.body;
  if (alias !== undefined && (typeof alias !== 'string' || !/^[A-Za-z0-9_-]{3,32}$/.test(alias))) throw fail(400, 'Custom alias must contain 3–32 letters, numbers, hyphens, or underscores.');
  if (typeof title !== 'string' || title.length > 100) throw fail(400, 'Title must contain at most 100 characters.');
  const data = { userId: req.user.id, url: destination(url), title: title.trim(), expiresAt: expiration(expiresAt) };
  for (let attempt = 0; attempt < 4; attempt++) {
    try { const link = await Link.create({ ...data, code: alias || randomBytes(6).toString('base64url') }); return res.status(201).json({ link: view(link) }); }
    catch (err) { if (err.code !== 11000) throw err; if (alias) throw fail(409, 'This alias is taken. Try another.'); }
  }
  throw fail(503, 'Could not allocate a link. Please retry.');
}));
app.get('/api/links/:code/stats', asyncRoute(async (req, res) => {
  const link = await Link.findOne({ code: req.params.code, userId: req.user.id });
  if (!link) throw fail(404, 'Link not found.');
  res.json({ link: view(link) });
}));
app.patch('/api/links/:code', asyncRoute(async (req, res) => {
  const update = {};
  if (req.body.url !== undefined) update.url = destination(req.body.url);
  if (req.body.expiresAt !== undefined) update.expiresAt = expiration(req.body.expiresAt);
  if (req.body.title !== undefined) {
    if (typeof req.body.title !== 'string' || req.body.title.length > 100) throw fail(400, 'Title must contain at most 100 characters.');
    update.title = req.body.title.trim();
  }
  if (!Object.keys(update).length) throw fail(400, 'Provide a URL, title, or expiry to update.');
  const link = await Link.findOneAndUpdate({ code: req.params.code, userId: req.user.id }, { $set: update }, { new: true, runValidators: true });
  if (!link) throw fail(404, 'Link not found.');
  res.json({ link: view(link) });
}));
app.delete('/api/links/:code', asyncRoute(async (req, res) => {
  const link = await Link.findOneAndDelete({ code: req.params.code, userId: req.user.id });
  if (!link) throw fail(404, 'Link not found.');
  res.status(204).end();
}));
module.exports = { app: errors(app), db, redis, Link };
