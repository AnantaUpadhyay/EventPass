const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const { setTimeout: delay } = require("node:timers/promises");
const base =
  process.env.TEST_BASE ||
  process.argv.find((arg) => arg.startsWith("--base="))?.slice(7) ||
  "http://127.0.0.1:8080";
const runId = randomUUID().slice(0, 8);
const report = { base, runId, startedAt: new Date().toISOString(), checks: [] };
const emails = [];
let eventId;
async function req(path, { token, body, ...options } = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.headers.get("content-type")?.includes("json")
    ? await response.json()
    : null;
  return { status: response.status, data, headers: response.headers };
}
function passed(name) {
  report.checks.push({ name, status: "passed" });
  console.log(`PASS ${name}`);
}
async function main() {
  const health = await req("/api/system");
  assert.equal(health.status, 200);
  for (const name of ["auth", "catalog", "booking", "notifications"])
    assert.equal((await req(`/api/health/${name}`)).status, 200, name);
  passed(
    "All four EventPass service instances are healthy through the gateway",
  );
  assert.equal((await req("/api/booking/mine")).status, 401);
  assert.equal((await req("/api/links")).status, 404);
  assert.equal((await req("/internal/outbox")).status, 404);
  passed(
    "Protected endpoints reject anonymous requests; internal endpoints are not exposed",
  );
  const users = [];
  for (let i = 0; i < 2; i++) {
    const email = `test-${runId}-${i}@example.test`;
    emails.push(email);
    const response = await req("/api/auth/register", {
      method: "POST",
      body: {
        name: `Integration ${i}`,
        email,
        password: "a-safe-test-password",
        role: "admin",
        universityId: "bennett",
        organizerRequested: i === 0,
      },
    });
    assert.equal(response.status, 201);
    assert.equal(response.data.user.role, "student");
    users.push(response.data);
  }
  assert.equal(
    (
      await req("/api/auth/login", {
        method: "POST",
        body: { email: emails[0], password: "wrong" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await req("/api/auth/register", {
        method: "POST",
        body: {
          name: "Duplicate",
          universityId: "bennett",
          email: emails[0],
          password: "a-safe-test-password",
        },
      })
    ).status,
    409,
  );
  assert.equal(
    (await req("/api/auth/me", { token: users[0].token })).data.user.email,
    emails[0],
  );
  passed(
    "Registration, login, profile, duplicate protection, and role-escalation prevention",
  );
  const admin = await req("/api/auth/login", {
    method: "POST",
    body: {
      email: "organizer@college.edu",
      password: process.env.DEMO_PASSWORD || "student123",
    },
  });
  assert.equal(admin.status, 200);
  const fixture = {
    title: `[TEST ${runId}] Booking race fixture`,
    description: "Disposable integration test event.",
    category: "Workshop",
    venue: "Integration test lab",
    date: "2099-11-20",
    time: "18:00 IST",
    price: 499,
    seatLayout: { rows: 2, seatsPerRow: 3 },
  };
  assert.equal(
    (
      await req("/api/catalog/events", {
        method: "POST",
        token: users[0].token,
        body: fixture,
      })
    ).status,
    403,
  );
  assert.equal((await req("/api/auth/organizer-requests", {
    method: "POST", token: users[1].token,
  })).data.user.organizerRequested, true);
  const pending = await req("/api/auth/organizer-requests", { token: admin.data.token });
  assert(pending.data.users.some(u => u.id === users[0].user.id));
  assert.equal((await req(`/api/auth/organizer-requests/${users[0].user.id}/approve`, {
    method: "PATCH", token: users[0].token,
  })).status, 403);
  assert.equal((await req(`/api/auth/organizer-requests/${users[0].user.id}/approve`, {
    method: "PATCH", token: admin.data.token,
  })).data.user.role, "organizer");
  const organizer = await req("/api/auth/login", { method: "POST", body: {
    email: emails[0], password: "a-safe-test-password", universityId: "bennett",
  } });
  assert.equal(organizer.data.user.universityId, "bennett");
  assert.equal((await req("/api/auth/login", { method: "POST", body: {
    email: emails[0], password: "a-safe-test-password", universityId: "du",
  } })).status, 403);
  assert.equal((await req("/api/catalog/events", { method: "POST", token: organizer.data.token,
    body: { ...fixture, universityId: "du" },
  })).status, 403);
  fixture.universityId = "bennett";
  fixture.academicTrack = "Tech";
  const created = await req("/api/catalog/events", {
    method: "POST",
    token: organizer.data.token,
    body: fixture,
  });
  assert.equal(created.status, 201);
  eventId = created.data.event._id;
  const campusEvents = await req("/api/catalog/campus/events?universityId=bennett&track=Tech&upcoming=true");
  assert(campusEvents.data.events.some(e => e._id === eventId));
  assert(campusEvents.data.events.every(e => e.universityId === "bennett" && e.academicTrack === "Tech" && e.date));
  const otherCampus = await req("/api/catalog/campus/events?universityId=du", { token: users[0].token });
  assert.equal(otherCampus.status, 200);
  assert(otherCampus.data.events.length > 0);
  assert(otherCampus.data.events.every(event => event.universityId === "du"));
  passed("University sign-in, admin-only organizer approval, scoped publishing, academic labels and cross-university browsing");
  const reviewPath = `/api/catalog/events/${eventId}/reviews`;
  assert.equal((await req(reviewPath, { method: "PUT", body: { rating: 5 } })).status, 401);
  for (let i = 0; i < 2; i++) assert.equal((await req(reviewPath, {
    method: "PUT", token: users[i].token, body: { rating: i ? 3 : 5, comment: "A thoughtful campus event <script>not HTML</script>" },
  })).status, 200);
  let reviews = await req(reviewPath);
  assert.equal(reviews.data.count, 2); assert.equal(reviews.data.average, 4);
  await req(reviewPath, { method: "PUT", token: users[0].token, body: { rating: 4, comment: "Updated review" } });
  reviews = await req(reviewPath);
  assert.equal(reviews.data.count, 2); assert.equal(reviews.data.average, 3.5);
  assert.equal((await req(reviewPath, { method: "PUT", token: users[0].token, body: { rating: 6 } })).status, 400);
  assert.equal((await req(reviewPath, { method: "DELETE", token: users[1].token })).status, 204);
  reviews = await req(reviewPath);
  assert.equal(reviews.data.count, 1); assert.equal(reviews.data.reviews[0].userId, users[0].user.id);
  assert.equal((await req("/api/catalog/events/not-real/reviews")).status, 404);
  passed("Persistent ratings, average/count, review replacement, validation and account-scoped deletion");
  const unknownSearch = await req(
    `/api/catalog/events?search=no-such-event-${runId}`,
  );
  assert.equal(unknownSearch.status, 200);
  assert.equal(unknownSearch.data.events.length, 0);
  await req(`/api/catalog/events?search=${runId}`);
  const cached = await req(`/api/catalog/events?search=${runId}`);
  assert.equal(cached.data.cached, true);
  assert.equal(cached.data.events[0]._id, eventId);
  passed(
    "Approved organizer event creation, empty searches, cache-aside hits, and seeded string IDs",
  );
  assert.equal(
    (
      await req("/api/booking/hold", {
        method: "POST",
        token: users[0].token,
        body: { eventId, seatId: "Z99" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/api/booking/confirm", {
        method: "POST",
        token: users[0].token,
        headers: { "Idempotency-Key": randomUUID() },
        body: { eventId, seatId: "A1" },
      })
    ).status,
    409,
  );
  passed("Booking rejects invalid seats and confirmation without a valid hold");
  // Distinct users compete concurrently for one seat; repeated holds by an owner are idempotent.
  const holds = await Promise.all(
    users.map((user) =>
      req("/api/booking/hold", {
        method: "POST",
        token: user.token,
        body: { eventId, seatId: "A1", userId: "spoofed-user" },
      }),
    ),
  );
  assert.equal(holds.filter((r) => r.status === 200).length, 1);
  assert.equal(holds.filter((r) => r.status === 409).length, 1);
  const winnerIndex = holds.findIndex((r) => r.status === 200);
  const winner = users[winnerIndex],
    loser = users[1 - winnerIndex];
  const otherAccountMap = await req(`/api/booking/seats/${eventId}`, {
    token: loser.token,
  });
  assert.equal(otherAccountMap.data.grid[0].seats[0].status, "HELD");
  assert.equal(otherAccountMap.data.grid[0].seats[0].mine, false);
  const originalAccountMap = await req(`/api/booking/seats/${eventId}`, {
    token: winner.token,
  });
  assert.equal(originalAccountMap.data.grid[0].seats[0].mine, true);
  passed(
    "A different account sees held seats as unavailable; only the owner sees them as mine",
  );
  const conflicts = await Promise.all(
    Array.from({ length: 40 }, () =>
      req("/api/booking/hold", {
        method: "POST",
        token: loser.token,
        body: { eventId, seatId: "A1" },
      }),
    ),
  );
  assert.ok(conflicts.every((r) => r.status === 409));
  assert.equal(
    (
      await req("/api/booking/release", {
        method: "POST",
        token: loser.token,
        body: { eventId, seatId: "A1" },
      })
    ).status,
    409,
  );
  passed(
    "Atomic reservation: one owner wins; 40 competing holds and unauthorized release are rejected",
  );
  const keys = Array.from({ length: 20 }, () => randomUUID());
  const confirmations = await Promise.all(
    keys.map((key) =>
      req("/api/booking/confirm", {
        method: "POST",
        token: winner.token,
        headers: { "Idempotency-Key": key },
        body: { eventId, seatId: "A1", price: -1, userId: loser.user.id },
      }),
    ),
  );
  assert.equal(confirmations.filter((r) => r.status === 201).length, 1);
  assert.ok(confirmations.every((r) => [201, 409].includes(r.status)));
  const win = confirmations.findIndex((r) => r.status === 201),
    booking = confirmations[win].data.booking;
  assert.equal(booking.price, 499);
  assert.equal(booking.userId, winner.user.id);
  assert.match(booking.qrCodeData, /^data:image\/png;base64,/);
  const replay = await req("/api/booking/confirm", {
    method: "POST",
    token: winner.token,
    headers: { "Idempotency-Key": keys[win] },
    body: { eventId, seatId: "A1" },
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.data.booking.bookingId, booking.bookingId);
  const seatMap = await req(`/api/booking/seats/${eventId}`, {
    token: winner.token,
  });
  assert.equal(seatMap.data.bookedCount, 1);
  assert.equal(seatMap.data.grid[0].seats[0].status, "BOOKED");
  assert.equal(
    (await req(`/api/booking/user/${winner.user.id}`, { token: loser.token }))
      .status,
    403,
  );
  const fresh = await req(`/api/catalog/events?search=${runId}`);
  assert.equal(fresh.data.events[0].availableSeats, 5);
  passed(
    "20 concurrent checkouts produce one booking; retries return the same ticket; identity and price are server-derived",
  );
  await req("/api/booking/hold", {
    method: "POST",
    token: loser.token,
    body: { eventId, seatId: "A2" },
  });
  assert.equal(
    (
      await req("/api/booking/release", {
        method: "POST",
        token: loser.token,
        body: { eventId, seatId: "A2" },
      })
    ).status,
    200,
  );
  passed("Owned hold release returns the seat to availability");
  await req("/api/booking/hold", {
    method: "POST",
    token: winner.token,
    body: { eventId, seatId: "A3" },
  });
  const redis = require("redis").createClient({
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  });
  await redis.connect();
  await redis.pExpire(`hold:{${eventId}}:A3`, 50);
  await redis.zAdd(`holds:{${eventId}}`, [
    { score: Date.now() + 50, value: "A3" },
  ]);
  await delay(100);
  assert.equal(
    (
      await req("/api/booking/confirm", {
        method: "POST",
        token: winner.token,
        headers: { "Idempotency-Key": randomUUID() },
        body: { eventId, seatId: "A3" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req("/api/booking/hold", {
        method: "POST",
        token: loser.token,
        body: { eventId, seatId: "A3" },
      })
    ).status,
    200,
  );
  await req("/api/booking/release", {
    method: "POST",
    token: loser.token,
    body: { eventId, seatId: "A3" },
  });
  await redis.quit();
  passed(
    "An expired lease rejects old-owner checkout and permits a new owner to reserve",
  );
  const bundle = { eventId, seatIds: ["A2", "B1"] };
  assert.equal(
    (
      await req("/api/booking/hold", {
        method: "POST",
        token: winner.token,
        body: bundle,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("/api/booking/hold", {
        method: "POST",
        token: loser.token,
        body: { eventId, seatIds: ["A2", "B2"] },
      })
    ).status,
    409,
  );
  const groupMap = await req(`/api/booking/seats/${eventId}`, {
    token: loser.token,
  });
  assert.equal(
    groupMap.data.grid[1].seats[1].status,
    "AVAILABLE",
    "Failed group hold must not reserve B2",
  );
  assert.equal(
    (
      await req("/api/booking/hold", {
        method: "POST",
        token: loser.token,
        body: { eventId, seatIds: ["B2", "B2"] },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/api/booking/confirm", {
        method: "POST",
        token: winner.token,
        headers: { "Idempotency-Key": randomUUID() },
        body: { eventId, seatIds: ["A2", "B2"] },
      })
    ).status,
    409,
  );
  const groupKey = randomUUID();
  const group = await req("/api/booking/confirm", {
    method: "POST",
    token: winner.token,
    headers: { "Idempotency-Key": groupKey },
    body: bundle,
  });
  assert.equal(group.status, 201);
  assert.equal(group.data.booking.price, 998);
  assert.equal(group.data.booking.quantity, 2);
  assert.deepEqual(group.data.booking.seatNumbers, ["A2", "B1"]);
  const groupReplay = await req("/api/booking/confirm", {
    method: "POST",
    token: winner.token,
    headers: { "Idempotency-Key": groupKey },
    body: { eventId, seatIds: ["B1", "A2"] },
  });
  assert.equal(groupReplay.status, 200);
  assert.equal(
    groupReplay.data.booking.bookingId,
    group.data.booking.bookingId,
  );
  const bundleFresh = await req(`/api/catalog/events?search=${runId}`);
  assert.equal(bundleFresh.data.events[0].availableSeats, 3);
  assert.equal(
    (
      await req("/api/booking/hold", {
        method: "POST",
        token: loser.token,
        body: { eventId, seatIds: ["B1", "B2"] },
      })
    ).status,
    409,
  );
  passed(
    "Multi-seat holds and checkout are all-or-nothing, totals and inventory count seats, and group retries are idempotent",
  );
  let sent = false;
  for (let i = 0; i < 20; i++) {
    const result = await req("/api/notifications/mine", {
      token: winner.token,
    });
    if (
      result.data.notifications.some(
        (n) => n.bookingId === booking.bookingId && n.status === "SENT",
      )
    ) {
      sent = true;
      break;
    }
    await delay(1000);
  }
  assert.ok(sent, "SMTP notification should be delivered to local Mailpit");
  passed(
    "Durable booking outbox reaches the SMTP worker and records SENT delivery",
  );
}
async function cleanup() {
  // Delete only this run's disposable fixtures; never touch seeded or user-created records.
  const mongoose = require("mongoose");
  const connection = await mongoose
    .createConnection(process.env.TEST_MONGO || "mongodb://127.0.0.1:27017")
    .asPromise();
  try {
    if (eventId) {
      await connection
        .useDb("eventpass_catalog")
        .collection("events")
        .deleteOne({ _id: eventId });
      await connection
        .useDb("eventpass_booking")
        .collection("bookings")
        .deleteMany({ eventId });
    }
    const users = await connection
      .useDb("eventpass_auth")
      .collection("users")
      .find({ email: { $in: emails } })
      .toArray();
    const ids = users.map((u) => String(u._id));
    await connection.useDb("eventpass_catalog").collection("reviews").deleteMany({ userId: { $in: ids } });
    await connection
      .useDb("eventpass_notifications")
      .collection("notifications")
      .deleteMany({ userId: { $in: ids } });
    await connection
      .useDb("eventpass_auth")
      .collection("users")
      .deleteMany({ email: { $in: emails } });
    const redis = require("redis").createClient({
      url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    });
    await redis.connect();
    await redis.incr("catalog:version");
    if (eventId) {
      const keys = await redis.keys(`*{${eventId}}*`);
      if (keys.length) await redis.del(keys);
      await redis.del(`event:${eventId}`);
    }
    await redis.quit();
  } finally {
    await connection.close();
  }
}
main()
  .then(() => {
    report.status = "passed";
  })
  .catch((err) => {
    report.status = "failed";
    report.error = err.message;
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (err) {
      console.error("Fixture cleanup:", err.message);
      report.cleanupError = err.message;
      process.exitCode = 1;
    }
    report.finishedAt = new Date().toISOString();
    fs.mkdirSync("artifacts", { recursive: true });
    fs.writeFileSync(
      base.includes(":9080")
        ? "artifacts/integration-results-nginx.json"
        : "artifacts/integration-results.json",
      JSON.stringify(report, null, 2),
    );
    console.log(
      `Integration checks: ${report.status}. Evidence: artifacts/integration-results.json`,
    );
  });
