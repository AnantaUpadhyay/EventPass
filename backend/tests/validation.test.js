const { test } = require("node:test");
const assert = require("node:assert/strict");
process.env.JWT_SECRET = "test-only-secret-with-at-least-thirty-two-characters";
const { validateSeat } = require("../shared/validation");
const { sign, auth } = require("../shared/http");
const event = { date: "2099-11-20", seatLayout: { rows: 5, seatsPerRow: 10 } };
test("seat validation rejects nonexistent, malformed and past-event seats", () => {
  assert.equal(validateSeat(event, "A1"), "A1");
  assert.equal(validateSeat(event, "E10"), "E10");
  for (const seat of ["F1", "A11", "A0", "A01", "a1", "", null, {}, "A1:extra"])
    assert.throws(
      () => validateSeat(event, seat),
      (e) => e.status === 400,
    );
  assert.throws(
    () => validateSeat({ ...event, date: "2000-01-01" }, "A1"),
    (e) => e.status === 409,
  );
});
test("JWT verification requires the correct signature, issuer, audience and expiry", () => {
  const user = {
    _id: "user1",
    name: "Test",
    email: "test@example.com",
    role: "student",
  };
  const token = sign(user);
  const req = { headers: { authorization: `Bearer ${token}` } };
  let error;
  auth(req, {}, (e) => {
    error = e;
  });
  assert.equal(error, undefined);
  assert.equal(req.user.id, "user1");
  auth(
    { headers: { authorization: `Bearer ${token.slice(0, -5)}xxxxx` } },
    {},
    (e) => {
      error = e;
    },
  );
  assert.equal(error.status, 401);
  auth({ headers: {} }, {}, (e) => {
    error = e;
  });
  assert.equal(error.status, 401);
});
