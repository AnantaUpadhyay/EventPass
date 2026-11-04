const { test } = require("node:test");
const assert = require("node:assert/strict");
process.env.JWT_SECRET = "test-only-secret-with-at-least-thirty-two-characters";
const User = require("../services/auth-service/src/models/user.model");
const controller = require("../services/auth-service/src/controllers/auth.controller");

test("theme preferences belong to the authenticated account and survive profile reads", async () => {
  const users = new Map([['first', { _id: 'first', theme: 'dark' }], ['second', { _id: 'second' }]]);
  const originalUpdate = User.findByIdAndUpdate, originalFind = User.findById;
  User.findByIdAndUpdate = async (id, update, options) => {
    assert.deepEqual(Object.keys(update.$set), ['theme']);
    assert.equal(options.runValidators, true);
    const user = users.get(id);
    if (user) Object.assign(user, update.$set);
    return user;
  };
  User.findById = async id => users.get(id);
  let result;
  const res = { json: value => { result = value; } };
  try {
    await controller.preferences({ user: { id: 'first' }, body: { theme: 'light', id: 'second', role: 'admin' } }, res);
    assert.equal(result.user.theme, 'light');
    await controller.me({ user: { id: 'first' } }, res);
    assert.equal(result.user.theme, 'light');
    await controller.me({ user: { id: 'second' } }, res);
    assert.equal(result.user.theme, 'dark');
    for (const theme of ['purple', '', null, {}, 1])
      await assert.rejects(controller.preferences({ user: { id: 'first' }, body: { theme } }, res), error => error.status === 400);
    await assert.rejects(controller.preferences({ user: { id: 'missing' }, body: { theme: 'dark' } }, res), error => error.status === 401);
    assert.equal(new User({ name: 'New user' }).theme, 'dark');
  } finally {
    User.findByIdAndUpdate = originalUpdate;
    User.findById = originalFind;
  }
});
