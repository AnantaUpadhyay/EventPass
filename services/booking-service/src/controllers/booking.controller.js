const Booking = require('../models/booking.model');
const locks = require('../config/redis');
const { fail, serviceFetch } = require('../../../../shared/http');
const { validateSeat } = require('../../../../shared/validation');
const { randomUUID, randomBytes } = require('node:crypto');
const QRCode = require('qrcode');
const publicBooking = b => { const value = b.toObject ? b.toObject() : { ...b }; value.seatNumbers = Array.isArray(value.seatNumber) ? value.seatNumber : [value.seatNumber]; value.quantity = value.seatNumbers.length; value.seatNumber = value.seatNumbers.join(', '); delete value.outbox; delete value.__v; return value; };
function requestedSeats(body) {
  const seats = body.seatIds === undefined ? [body.seatId] : body.seatIds;
  if (!Array.isArray(seats) || !seats.length || seats.length > 10 || seats.some(s => typeof s !== 'string') || new Set(seats).size !== seats.length) throw fail(400, 'Choose between 1 and 10 different seats.');
  return [...seats].sort();
}
async function soldCount(eventId) {
  const [result] = await Booking.aggregate([{ $match: { eventId, status: 'CONFIRMED' } }, { $unwind: '$seatNumber' }, { $count: 'count' }]);
  return result?.count || 0;
}
async function eventFor(eventId, seatId) {
  if (typeof eventId !== 'string' || eventId.length > 100) throw fail(400, 'Invalid event.');
  const { event } = await serviceFetch(`${process.env.CATALOG_URL || 'http://127.0.0.1:5002'}/api/catalog/events/${encodeURIComponent(eventId)}`);
  if (seatId !== undefined) for (const seat of (Array.isArray(seatId) ? seatId : [seatId])) validateSeat(event, seat);
  return event;
}
exports.holdSeat = async (req, res) => {
  const { eventId } = req.body;
  const seatId = requestedSeats(req.body);
  
  const event = await eventFor(eventId, seatId);
  if (await Booking.exists({ eventId, seatNumber: { $in: seatId }, status: 'CONFIRMED' })) throw fail(409, 'This seat is already booked.');
  const count = await soldCount(eventId);
  const seconds = await locks.acquire(eventId, seatId, req.user.id, event.totalSeats, count);
  res.json({ seatIds: seatId, seatId: seatId[0], eventId, remainingSeconds: seconds, expiresAt: new Date(Date.now() + seconds * 1000) });
};
exports.releaseSeat = async (req, res) => {
  const { eventId } = req.body;
  const seatId = requestedSeats(req.body);
  
  await eventFor(eventId, seatId);
  const released = await locks.release(eventId, seatId, req.user.id);
  if (!released) throw fail(409, 'Hold has expired or belongs to another guest.');
  res.json({ success: true });
};
exports.getEventSeatMap = async (req, res) => {
  const event = await eventFor(req.params.eventId);
  const bookings = await Booking.find({ eventId: event._id, status: 'CONFIRMED' }).select('seatNumber').lean();
  const booked = new Set(bookings.flatMap(b => Array.isArray(b.seatNumber) ? b.seatNumber : [b.seatNumber]));
  const held = new Map((await locks.locks(event._id)).map(l => [l.seatId, l]));
  const grid = Array.from({ length: event.seatLayout.rows }, (_, r) => ({ row: String.fromCharCode(65 + r), seats: Array.from({ length: event.seatLayout.seatsPerRow }, (_, s) => {
    const seatId = `${String.fromCharCode(65 + r)}${s + 1}`;
    const lock = held.get(seatId);
    return { seatId, status: booked.has(seatId) ? 'BOOKED' : lock ? 'HELD' : 'AVAILABLE', mine: Boolean(lock && (lock.owner === req.user.id || lock.owner.startsWith(`${req.user.id}:checkout:`))), remainingSeconds: lock?.ttl || 0 };
  }) }));
  res.json({ eventId: event._id, totalSeats: event.totalSeats, bookedCount: booked.size, heldCount: [...held.keys()].filter(s => !booked.has(s)).length, grid });
};
exports.confirmBooking = async (req, res) => {
  const { eventId } = req.body;
  const seatId = requestedSeats(req.body);
  const requestId = req.headers['idempotency-key'];
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(requestId)) throw fail(400, 'A valid Idempotency-Key header is required.');
  const existing = await Booking.findOne({ userId: req.user.id, requestId });
  if (existing) {
    if (existing.eventId !== eventId || JSON.stringify([...existing.seatNumber].sort()) !== JSON.stringify(seatId)) throw fail(409, 'This checkout key was used for another seat.');
    return res.json({ booking: publicBooking(existing), replayed: true });
  }
  
  const event = await eventFor(eventId, seatId);
  const claimOwner = `${req.user.id}:checkout:${requestId}`;
  if (!await locks.claim(eventId, seatId, req.user.id, claimOwner)) throw fail(409, 'Your seat hold has expired. Select a seat again.');
  const ticketCode = `EP-${randomBytes(9).toString('hex').toUpperCase()}`;
  const bookingId = `BK_${randomUUID()}`;
  const qrCodeData = await QRCode.toDataURL(JSON.stringify({ version: 1, bookingId, ticketCode }), { width: 220, margin: 1, color: { dark: '#17151C', light: '#FFFFFF' } });
  let booking;
  try {
    booking = await Booking.create({ bookingId, requestId, userId: req.user.id, userName: req.user.name, userEmail: req.user.email, eventId, eventTitle: event.title, eventDate: event.date, eventTime: event.time, venue: event.venue, bannerUrl: event.bannerUrl, seatNumber: seatId, price: Math.round(event.price * 100) * seatId.length / 100, status: 'CONFIRMED', ticketCode, qrCodeData, outbox: { status: 'PENDING' } });
    locks.metrics.bookingsConfirmed++;
  } catch (err) {
    if (err.code === 11000) {
      const replay = await Booking.findOne({ userId: req.user.id, requestId });
      if (replay && replay.eventId === eventId && JSON.stringify([...replay.seatNumber].sort()) === JSON.stringify(seatId)) return res.json({ booking: publicBooking(replay), replayed: true });
      throw fail(409, 'This seat has already been booked. Choose another.');
    }
    // An ambiguous database failure leaves the short checkout lease to expire safely.
    throw err;
  }
  // Persistence is authoritative. Redis cleanup failure must not report a saved ticket as failed.
  try { await locks.release(eventId, seatId, claimOwner); } catch (err) { console.error('Post-booking hold cleanup:', err.message); }
  res.status(201).json({ booking: publicBooking(booking) });
};
exports.getUserBookings = async (req, res) => {
  if (req.params.userId && req.params.userId !== req.user.id) throw fail(403, 'You can view only your own tickets.');
  const bookings = await Booking.find({ userId: req.user.id }).sort({ bookedAt: -1 }).limit(100);
  res.json({ bookings: bookings.map(publicBooking), count: bookings.length });
};
exports.counts = async (req, res) => {
  const counts = await Booking.aggregate([{ $match: { status: 'CONFIRMED' } }, { $unwind: '$seatNumber' }, { $group: { _id: '$eventId', count: { $sum: 1 } } }]);
  res.json(Object.fromEntries(counts.map(c => [c._id, c.count])));
};
exports.pending = async (req, res) => {
  const query = { 'outbox.status': 'PENDING' };
  if (req.query.after && /^[0-9a-f]{24}$/.test(req.query.after)) query._id = { $gt: req.query.after };
  res.json({ bookings: await Booking.find(query).sort({ _id: 1 }).limit(20).lean() });
};
exports.ack = async (req, res) => {
  await Booking.updateOne({ bookingId: req.params.bookingId }, { $set: { 'outbox.status': 'SENT', 'outbox.sentAt': new Date() } });
  res.json({ success: true });
};
