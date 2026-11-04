const Event = require("../models/event.model");
const cache = require("../config/redis");
const { fail, serviceFetch } = require("../../../../shared/http");
const { randomUUID } = require("node:crypto");
exports.getAllEvents = async (req, res) => {
  const { category, search = "" } = req.query;
  if (
    typeof search !== "string" ||
    search.length > 120 ||
    (category && typeof category !== "string")
  )
    throw fail(400, "Invalid event filters.");
  const version = cache.ready()
    ? (await cache.client.get("catalog:version")) || "0"
    : "0";
  const key = `catalog:${version}:${JSON.stringify([category || "All", search])}`;
  let events = await cache.getCache(key);
  const cached = Boolean(events);
  if (!events) {
    const query = {};
    if (category && category !== "All") query.category = category;
    if (search) {
      const literal = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { title: { $regex: literal, $options: "i" } },
        { venue: { $regex: literal, $options: "i" } },
      ];
    }
    events = await Event.find(query).sort({ date: 1 }).lean();
    await cache.setCache(key, events);
  }
  // Static catalog data is cached; availability comes from durable confirmed bookings.
  let counts = null;
  try {
    counts = await serviceFetch(
      `${process.env.BOOKING_URL || "http://127.0.0.1:5003"}/internal/counts`,
    );
  } catch {}
  res.json({
    cached,
    source: cached ? "Redis cache" : "MongoDB",
    count: events.length,
    events: events.map((e) => ({
      ...e,
      availableSeats: counts
        ? Math.max(0, e.totalSeats - (counts[e._id] || 0))
        : null,
    })),
  });
};
exports.getEventById = async (req, res) => {
  const key = `event:${req.params.id}`;
  let event = await cache.getCache(key);
  if (!event) {
    event = await Event.findById(req.params.id).lean();
    if (event) await cache.setCache(key, event);
  }
  if (!event) throw fail(404, "Event not found.");
  res.json({ event });
};
exports.createEvent = async (req, res) => {
  const { university, tracks } = require("../../../../shared/campus");
  const {
    title,
    description,
    category,
    venue,
    date,
    time,
    price,
    bannerUrl = "",
    seatLayout,
  } = req.body;
  const universityId = req.user.role === "admin" ? req.body.universityId : req.user.universityId;
  if (universityId && !university(universityId)) throw fail(400, "Choose a supported university.");
  if (req.user.role !== "admin" && (!universityId || (req.body.universityId && req.body.universityId !== universityId)))
    throw fail(403, "You can publish only for your approved university.");
  const academicTrack = req.body.academicTrack || "Interdisciplinary";
  if (!tracks.includes(academicTrack)) throw fail(400, "Choose a supported academic area.");
  const { rows, seatsPerRow } = seatLayout || {};
  if (
    ![rows, seatsPerRow].every(Number.isInteger) ||
    rows < 1 ||
    rows > 20 ||
    seatsPerRow < 1 ||
    seatsPerRow > 20
  )
    throw fail(400, "Seat layout must contain 1–20 rows and seats per row.");
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    typeof time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d( IST)?$/.test(time)
  )
    throw fail(400, "Enter a valid date and 24-hour time.");
  if (
    !Number.isFinite(price) ||
    price < 0 ||
    Math.round(price * 100) !== price * 100
  )
    throw fail(400, "Enter a valid price with at most two decimal places.");
  if (bannerUrl && !/^https:\/\//.test(bannerUrl))
    throw fail(400, "Banner image must use HTTPS.");
  const event = await Event.create({
    _id: `evt_${randomUUID()}`,
    title,
    description,
    category,
    venue,
    date,
    time,
    price,
    bannerUrl,
    seatLayout,
    totalSeats: rows * seatsPerRow,
    universityId, academicTrack, createdBy: req.user.id,
  });
  await cache.invalidate();
  res.status(201).json({ event });
};
