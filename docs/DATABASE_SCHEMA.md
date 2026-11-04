# EventPass database schema

Each service owns a logical MongoDB database. ID references across services are strings and are validated through API calls; there are no cross-database joins in application services.

| Database / collection | Fields | Indexes and constraints |
| --- | --- | --- |
| `eventpass_auth.users` | `_id` ObjectId; `name`; normalized `email`; bcrypt `passwordHash`; `role`; `theme` (dark/light, default dark); `createdAt` | Unique email; role enum student/organizer/admin; public signup fixes student |
| `eventpass_catalog.events` | String `_id`; title; description; category; venue; ISO date; local IST time; INR price; bannerUrl; totalSeats; seatLayout; timestamps | Date/category index; nonnegative price; 1–400 capacity; 1–20 rows and columns |
| `eventpass_booking.bookings` | bookingId; requestId; userId; userName; userEmail; eventId; eventTitle; eventDate; eventTime; venue; bannerUrl; seatNumber; price snapshot; status; ticketCode; QR PNG data URI; bookedAt; embedded outbox | Unique bookingId and ticketCode; unique `(userId, requestId)`; partial unique `(eventId, seatNumber)` when CONFIRMED; outbox status/time index |
| `eventpass_notifications.notifications` | bookingId; userId; userEmail; eventTitle; status; attempts; leaseUntil; nextAttempt; messageId; lastError; sentAt; timestamps | Unique bookingId; worker claim uses atomic findOneAndUpdate |

## Example booking

```json
{
  "bookingId": "BK_<uuid>",
  "requestId": "<client-checkout-uuid>",
  "userId": "<authenticated-user-id>",
  "eventId": "evt_neon_nights_2026",
  "seatNumber": "A1",
  "price": 299,
  "status": "CONFIRMED",
  "ticketCode": "EP-<18-random-hex-characters>",
  "qrCodeData": "data:image/png;base64,...",
  "outbox": { "status": "PENDING" }
}
```

User-visible responses omit internal outbox fields. A unique partial index prevents two confirmed bookings for one seat even if Redis coordination fails or checkout timing overlaps. No multi-document transaction is needed to save a booking and its email intent because they occupy the same document.

## Redis coordination keys

| Key | Value | Lifetime |
| --- | --- | --- |
| `hold:{eventId}:A1` | User ID; temporarily user/request checkout owner | 600 seconds; checkout claims 30 seconds |
| `holds:{eventId}` | Sorted set of seat IDs scored by expiry milliseconds | 1,200-second container TTL; expired members removed on holds |
| `inventory:{eventId}` | Advisory remaining unheld capacity | Reconciled on hold; 1,200-second TTL |
| `catalog:version` | Version integer | Persistent until Redis reset |
| `catalog:<version>:<filters>` | JSON static event list | 3,600 seconds |
| `event:<id>` | JSON static event metadata | 3,600 seconds |
| `auth:limit:<address>` | Authentication request count | 60 seconds |

Braces in reservation keys keep per-event Lua keys in the same Redis cluster hash slot. This deployment uses a single Redis instance. MongoDB and Redis both persist to named Docker volumes; no application memory store substitutes for them.

## Group reservations

A booking stores `seatNumber` as an array of 1–10 unique seat IDs. Existing scalar records remain readable. The existing unique event/seat index becomes multikey for arrays, preventing any confirmed seat from appearing in another booking. One MongoDB insert commits the whole group and its mail outbox, so checkout cannot partially book a group. Public responses expose `seatNumbers`, `quantity`, a readable `seatNumber` string and the total group `price`. Inventory counts unwind the array and count seats rather than booking documents. Redis Lua validates every selected lock before acquiring or claiming any of them.
