const { fail } = require('./http');
function validateSeat(event, seatId) {
  const match = typeof seatId === 'string' && /^([A-T])([1-9]\d?)$/.exec(seatId);
  if (!match || match[1].charCodeAt(0) - 65 >= event.seatLayout.rows || Number(match[2]) > event.seatLayout.seatsPerRow) throw fail(400, 'This seat does not exist for this event.');
  if (new Date(`${event.date}T23:59:59+05:30`) < new Date()) throw fail(409, 'Booking for this event has closed.');
  return seatId;
}
function destination(value) {
  if (typeof value !== 'string' || value.length > 2048) throw fail(400, 'Enter a URL with at most 2048 characters.');
  let url;
  try { url = new URL(value); } catch { throw fail(400, 'Enter a complete http:// or https:// URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw fail(400, 'Use an HTTP or HTTPS URL without credentials.');
  return url.href;
}
module.exports = { validateSeat, destination };
