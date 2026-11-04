const mongoose = require("mongoose");
const EventSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 3000 },
    category: {
      type: String,
      enum: [
        "Concert",
        "Tech & Hackathon",
        "Workshop",
        "Sports & Gaming",
        "Conference",
        "Cultural Fest",
        "Summit",
        "Academic Seminar",
      ],
      required: true,
    },
    universityId: { type: String, enum: require("../../../../shared/universities.json").map(u => u.id) },
    academicTrack: { type: String, enum: require("../../../../shared/campus").tracks, default: "Interdisciplinary" },
    createdBy: String,
    venue: { type: String, required: true, maxlength: 160 },
    date: { type: String, required: true },
    time: { type: String, required: true },
    price: { type: Number, required: true, min: 0, max: 100000 },
    bannerUrl: { type: String, default: "" },
    totalSeats: { type: Number, required: true, min: 1, max: 400 },
    seatLayout: { rows: Number, seatsPerRow: Number },
  },
  { timestamps: true },
);
EventSchema.index({ date: 1, category: 1 });
module.exports = mongoose.model("Event", EventSchema);
