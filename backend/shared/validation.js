const { fail } = require("./http");
function validateSeat(event, seatId) {
  const match =
    typeof seatId === "string" && /^([A-T])([1-9]\d?)$/.exec(seatId);
  if (
    !match ||
    match[1].charCodeAt(0) - 65 >= event.seatLayout.rows ||
    Number(match[2]) > event.seatLayout.seatsPerRow
  )
    throw fail(400, "This seat does not exist for this event.");
  if (new Date(`${event.date}T23:59:59+05:30`) < new Date())
    throw fail(409, "Booking for this event has closed.");
  return seatId;
}
module.exports = { validateSeat };
