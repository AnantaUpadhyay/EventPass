const mongoose = require("mongoose");
const BookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  requestId: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  eventId: { type: String, required: true },
  eventTitle: { type: String, required: true },
  eventDate: String,
  eventTime: String,
  venue: String,
  bannerUrl: String,
  seatNumber: {
    type: [String],
    required: true,
    validate: (seats) =>
      seats.length > 0 && new Set(seats).size === seats.length,
  },
  price: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ["CONFIRMED", "CANCELLED"],
    default: "CONFIRMED",
  },
  ticketCode: { type: String, required: true, unique: true },
  qrCodeData: { type: String, required: true },
  bookedAt: { type: Date, default: Date.now },
  outbox: {
    status: { type: String, enum: ["PENDING", "SENT"], default: "PENDING" },
    sentAt: Date,
  },
});
BookingSchema.index(
  { eventId: 1, seatNumber: 1 },
  { unique: true, partialFilterExpression: { status: "CONFIRMED" } },
);
BookingSchema.index({ userId: 1, requestId: 1 }, { unique: true });
BookingSchema.index({ "outbox.status": 1, bookedAt: 1 });
module.exports = mongoose.model("Booking", BookingSchema);
