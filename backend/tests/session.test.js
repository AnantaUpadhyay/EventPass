const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';
const User = require('../services/auth-service/src/models/user.model');
const Session = require('../services/auth-service/src/models/session.model');
const controller = require('../services/auth-service/src/controllers/auth.controller');
test('persistent session restores identity, rejects expiry and is revoked on logout', async () => {
  const original = [Session.findOne, Session.deleteOne, User.findById];
  const raw = 'ab'.repeat(32);
  const hash = createHash('sha256').update(raw).digest('hex');
  let active = true, result, options, cleared = false;
  Session.findOne = async query => {
    assert.equal(query.tokenHash, hash);
    assert.ok(query.expiresAt.$gt instanceof Date);
    return active ? { userId: 'first', save: async () => {} } : null;
  };
  Session.deleteOne = async query => { assert.equal(query.tokenHash, hash); active = false; };
  User.findById = async () => ({ _id: 'first', name: 'Student', role: 'student' });
  const req = { headers: { cookie: `other=value; ep_session=${raw}` } };
  const res = { set() { return this; }, status() { return this; }, end() {}, json(value) { result = value; }, cookie(name, value, config) { assert.equal(value, raw); options = config; }, clearCookie() { cleared = true; } };
  try {
    await controller.session(req, res);
    assert.equal(result.user.id, 'first');
    assert.ok(result.token);
    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, 'strict');
    assert.equal(options.path, '/api/auth');
    await controller.logout(req, res);
    assert.ok(cleared);
    await assert.rejects(controller.session(req, res), err => err.status === 401);
    await assert.rejects(controller.session({ headers: {} }, res), err => err.status === 401);
  } finally { [Session.findOne, Session.deleteOne, User.findById] = original; }
});
