const mongoose = require("mongoose");
const ReviewSchema = new mongoose.Schema({
  eventId: { type: String, required: true, maxlength: 160 },
  userId: { type: String, required: true },
  userName: { type: String, required: true, maxlength: 80 },
  universityId: String,
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  comment: { type: String, maxlength: 2000, default: "" },
}, { timestamps: true });
ReviewSchema.index({ eventId: 1, userId: 1 }, { unique: true });
ReviewSchema.index({ eventId: 1, updatedAt: -1 });
module.exports = mongoose.model("Review", ReviewSchema);
