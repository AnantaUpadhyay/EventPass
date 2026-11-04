const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const {
  createApp,
  errors,
  asyncRoute,
  auth,
  admin,
  serviceFetch,
} = require("../../../shared/http");
const db = require("../../../shared/database")(mongoose, "notifications");
const Notification = mongoose.model(
  "Notification",
  new mongoose.Schema(
    {
      bookingId: { type: String, unique: true, required: true },
      userId: { type: String, required: true },
      userEmail: String,
      eventTitle: String,
      status: {
        type: String,
        enum: ["PENDING", "SENDING", "SENT", "FAILED"],
        default: "PENDING",
      },
      attempts: { type: Number, default: 0 },
      leaseUntil: Date,
      nextAttempt: { type: Date, default: Date.now },
      messageId: String,
      lastError: String,
      sentAt: Date,
    },
    { timestamps: true },
  ),
);
const smtp = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "127.0.0.1",
  port: Number(process.env.SMTP_PORT || 1025),
  secure: process.env.SMTP_SECURE === "true",
  ...(process.env.SMTP_USER
    ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
    : {}),
  connectionTimeout: 5000,
  socketTimeout: 10000,
  disableFileAccess: true,
  disableUrlAccess: true,
});
const app = createApp("notification-service", () => ({ mongo: db.ready() }));
app.get(
  "/api/notifications/mine",
  auth,
  asyncRoute(async (req, res) =>
    res.json({
      notifications: await Notification.find({ userId: req.user.id })
        .select("-lastError")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    }),
  ),
);
app.get(
  "/api/notifications/logs",
  auth,
  admin,
  asyncRoute(async (req, res) =>
    res.json({
      notifications: await Notification.find()
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    }),
  ),
);
const bookingURL = process.env.BOOKING_URL || "http://127.0.0.1:5003";
let running = false;
let cursor = "";
async function tick() {
  if (running) return;
  running = true;
  try {
    const { bookings } = await serviceFetch(
      `${bookingURL}/internal/outbox?after=${cursor}`,
    );
    if (!bookings.length) cursor = "";
    for (const b of bookings) {
      cursor = String(b._id);
      await Notification.updateOne(
        { bookingId: b.bookingId },
        {
          $setOnInsert: {
            userId: b.userId,
            userEmail: b.userEmail,
            eventTitle: b.eventTitle,
            status: "PENDING",
          },
        },
        { upsert: true },
      );
      const existing = await Notification.findOne({ bookingId: b.bookingId });
      if (existing.status === "SENT") {
        await serviceFetch(`${bookingURL}/internal/outbox/${b.bookingId}/ack`, {
          method: "POST",
        });
        continue;
      }
      const job = await Notification.findOneAndUpdate(
        {
          bookingId: b.bookingId,
          nextAttempt: { $lte: new Date() },
          $or: [
            { status: { $in: ["PENDING", "FAILED"] } },
            { status: "SENDING", leaseUntil: { $lt: new Date() } },
          ],
        },
        {
          $set: { status: "SENDING", leaseUntil: new Date(Date.now() + 60000) },
          $inc: { attempts: 1 },
        },
        { new: true },
      );
      if (!job) continue;
      try {
        const info = await smtp.sendMail({
          from: process.env.SMTP_FROM || "EventPass <tickets@eventpass.local>",
          to: b.userEmail,
          subject: `You're in. ${b.eventTitle}`,
          messageId: `<${b.bookingId}@eventpass.local>`,
          text: `Hi ${b.userName},\n\nYour seat is confirmed.\n\n${b.eventTitle}\n${b.eventDate} · ${b.eventTime}\n${b.venue}\nSeat ${b.seatNumber}\nTicket ${b.ticketCode}\n\nMock checkout — no payment was collected.\n\nSee you there,\nEventPass`,
          attachments: [
            {
              filename: "eventpass-qr.png",
              content: b.qrCodeData.split(",")[1],
              encoding: "base64",
            },
          ],
        });
        await Notification.updateOne(
          { _id: job._id },
          {
            $set: {
              status: "SENT",
              sentAt: new Date(),
              messageId: info.messageId,
              lastError: "",
            },
          },
        );
        await serviceFetch(`${bookingURL}/internal/outbox/${b.bookingId}/ack`, {
          method: "POST",
        });
      } catch (err) {
        await Notification.updateOne(
          { _id: job._id, status: "SENDING" },
          {
            $set: {
              status: "FAILED",
              lastError: err.message,
              nextAttempt: new Date(
                Date.now() +
                  Math.min(300000, 2000 * 2 ** Math.min(job.attempts, 8)),
              ),
            },
          },
        );
      }
    }
  } catch (err) {
    console.error("[mail worker]", err.message);
  } finally {
    running = false;
  }
}
module.exports = { app: errors(app), db, Notification, tick };
