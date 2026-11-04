const { universities, tracks, university } = require("../../../../shared/campus");
const curated = require("../data/campusEvents.json");
const Event = require("../models/event.model");
const { fail } = require("../../../../shared/http");
exports.options = (req, res) => res.json({ universities, tracks });
exports.list = async (req, res) => {
  const { universityId = "", track = "", search = "", upcoming = "false" } = req.query;
  if ((universityId && !university(universityId)) || (track && !tracks.includes(track)) ||
      typeof search !== "string" || search.length > 120 || !["true", "false"].includes(upcoming))
    throw fail(400, "Invalid university event filters.");
  const query = { universityId: universityId || { $exists: true } };
  if (track) query.academicTrack = track;
  // shortcut: cap native listings per filter at 200; add pagination when a campus exceeds this.
  const native = await Event.find(query).sort({ date: 1 }).limit(200).lean();
  const today = new Date(Date.now() + 19800000).toISOString().slice(0, 10);
  const events = [...curated, ...native].map(event => ({
    ...event, university: university(event.universityId),
    status: !event.date ? "Dates unconfirmed" : (event.endDate || event.date) < today ? "Past edition" : "Upcoming",
  })).filter(event => (!universityId || event.universityId === universityId) &&
    (!track || event.academicTrack === track) &&
    (!search || `${event.title} ${event.university?.name}`.toLowerCase().includes(search.toLowerCase())) &&
    (upcoming !== "true" || event.status === "Upcoming"))
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  res.json({ events, count: events.length });
};
