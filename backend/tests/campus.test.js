const test = require("node:test");
const assert = require("node:assert/strict");
process.env.JWT_SECRET = "test-only-secret-with-at-least-thirty-two-characters";
const { universities, tracks, university } = require("../shared/campus");
const listings = require("../services/catalog-service/src/data/campusEvents.json");
const Event = require("../services/catalog-service/src/models/event.model");
const Review = require("../services/catalog-service/src/models/review.model");
const campus = require("../services/catalog-service/src/controllers/campus.controller");
const { sign, auth } = require("../shared/http");
test("campus research uses supported universities, tracks, unique IDs and HTTPS sources", () => {
  assert.equal(new Set(universities.map(u => u.id)).size, universities.length);
  assert.equal(new Set(listings.map(e => e._id)).size, listings.length);
  for (const event of listings) {
    assert(university(event.universityId)); assert(tracks.includes(event.academicTrack));
    assert.equal(new URL(event.sourceUrl).protocol, "https:");
    if (event.date) assert.equal(new Date(event.date).toISOString().slice(0, 10), event.date);
    assert(!("price" in event)); assert(!("totalSeats" in event));
  }
});
test("unconfirmed festival series never pass the upcoming-date filter", async () => {
  const original = Event.find;
  Event.find = () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) });
  let body; const res = { json: value => { body = value; } };
  try {
    await campus.list({ query: { upcoming: "true" } }, res);
    assert(body.events.every(e => e.date && e.status === "Upcoming"));
    await campus.list({ query: { universityId: "bennett", track: "Tech" } }, res);
    assert(body.events.length > 0);
    assert(body.events.every(e => e.universityId === "bennett" && e.academicTrack === "Tech"));
    await assert.rejects(campus.list({ query: { universityId: "invented" } }, res), e => e.status === 400);
  } finally { Event.find = original; }
});
test("review schema enforces one account per event and whole-star ratings", () => {
  assert(Review.schema.indexes().some(([keys, options]) => keys.eventId === 1 && keys.userId === 1 && options.unique));
  for (const rating of [0, 6, 2.5]) {
    assert(new Review({ eventId: "event", userId: "user", userName: "Student", rating }).validateSync());
  }
  assert(!new Review({ eventId: "event", userId: "user", userName: "Student", rating: 5, comment: "Good event" }).validateSync());
});
test("signed organizer tokens include their university scope", () => {
  const token = sign({ _id: "organizer", name: "Organizer", role: "organizer", universityId: "bennett" });
  const req = { headers: { authorization: `Bearer ${token}` } };
  auth(req, {}, error => assert.equal(error, undefined));
  assert.equal(req.user.universityId, "bennett");
});

test("festival imagery has source credits and valid local responsive JPEG assets", () => {
  const fs = require("node:fs"), path = require("node:path");
  for (const event of listings.filter(item => item.image)) {
    const image = event.image;
    assert(["photograph", "artwork"].includes(image.type));
    assert(image.alt && image.caption && image.credit);
    assert.equal(new URL(image.sourceUrl).protocol, "https:");
    assert.equal(new URL(image.originalUrl).protocol, "https:");
    for (const asset of [image.src, image.thumbnail]) {
      assert(/^\/assets\/fests\/[a-z0-9-]+\.jpg$/.test(asset));
      const bytes = fs.readFileSync(path.join(__dirname, "../../frontend/public", asset));
      assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8);
      assert(bytes.length > 1000);
    }
  }
});
