const Review = require("../models/review.model");
const Event = require("../models/event.model");
const curated = require("../data/campusEvents.json");
const cache = require("../config/redis");
const { fail } = require("../../../../shared/http");
async function exists(id) {
  if (typeof id !== "string" || id.length > 160 ||
      (!curated.some(event => event._id === id) && !(await Event.exists({ _id: id }))))
    throw fail(404, "Event not found.");
}
exports.list = async (req, res) => {
  await exists(req.params.id);
  const page = Number(req.query.page || 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw fail(400, "Invalid comment page.");
  const filter = { eventId: req.params.id };
  const [reviews, summary] = await Promise.all([
    Review.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20)
      .select("userId userName universityId rating comment updatedAt").lean(),
    Review.aggregate([{ $match: filter }, { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }]),
  ]);
  res.set("Cache-Control", "no-store").json({ reviews, page, average: summary[0]?.average || 0, count: summary[0]?.count || 0 });
};
exports.save = async (req, res) => {
  await exists(req.params.id);
  const { rating, comment = "" } = req.body || {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof comment !== "string" || comment.length > 2000 || /[\u0000-\u0008]/.test(comment))
    throw fail(400, "Choose 1–5 stars and a comment of up to 2,000 characters.");
  if (!cache.ready()) throw fail(503, "Comments are temporarily unavailable.");
  const count = await cache.client.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n", {
    keys: [`reviews:limit:${req.user.id}`], arguments: [],
  });
  if (count > 10) throw fail(429, "Please wait before posting another review.");
  const review = await Review.findOneAndUpdate({ eventId: req.params.id, userId: req.user.id }, {
    $set: { rating, comment: comment.trim(), userName: req.user.name, universityId: req.user.universityId || undefined },
  }, { upsert: true, new: true, runValidators: true });
  res.json({ review });
};
exports.remove = async (req, res) => {
  await exists(req.params.id);
  await Review.deleteOne({ eventId: req.params.id, userId: req.user.id });
  res.status(204).end();
};
