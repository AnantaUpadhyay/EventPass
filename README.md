# EventPass

An event discovery and booking app built with React, Express, MongoDB and Redis. Users can browse events, reserve up to ten seats, and receive a QR ticket. Organizers can create events. City-based discovery finds third-party listings and links to their booking providers.

The backend has four services: authentication, catalog, booking and notifications. Redis coordinates seat holds; MongoDB stores confirmed bookings. Checkout is a demo and does not collect payments.

## Run locally

Requires Node.js 22.12 or newer, npm and Docker Desktop.

```sh
npm install
npm run setup
docker compose up -d mongo redis mailpit
npm run dev
```

- App: http://localhost:3000
- API gateway: http://localhost:8080
- Local email inbox: http://localhost:8025

Setup creates a local `.env` with random secrets. Do not commit this file.

For local testing, `SEED_DEMO=true` creates these accounts:

| Role | Email | Password |
| --- | --- | --- |
| Student | student@college.edu | student123 |
| Admin | organizer@college.edu | student123 |

These accounts are for local development. Disable demo seeding for a public deployment.

## Structure

```text
frontend/
  src/components/        Shared UI and ticket component
  src/context/           Authentication state
  src/pages/             Event discovery, reservations and admin screens
  public/                Images and fonts
backend/
  services/
    auth-service/        Registration, login and profiles
    catalog-service/     Event data, cache and third-party discovery
    catalog-reader/      Private read-only catalog entrypoint for Vercel
    booking-service/     Holds, checkout and saved tickets
    notification-service/ SMTP delivery and retries
    gateway/             Local reverse proxy
  shared/                Authentication, validation and connection helpers
  infra/                 NGINX configuration
  tests/                 Backend unit tests
scripts/                 Setup, process runner and integration tests
docs/                    Schema, architecture and API examples
```

Each local service has its own `server.js` and package manifest. The Vercel-only catalog reader reuses the catalog service implementation. Auth, catalog and booking use routes, controllers, models and config folders. The smaller notification service keeps its worker and delivery model in `src/app.js`.

Use `npm run dev:frontend` and `npm run dev:backend` in separate terminals if preferred. Install dependencies once from the repository root.

## Reservation flow

1. Clicking a seat requests a Redis hold immediately. The server validates the seat and authenticated owner.
2. A Lua script checks all requested seats before acquiring the group. Overlapping requests receive a conflict without a partial hold.
3. Holds expire after up to ten minutes. Signing out does not release them; deselection or explicit release does.
4. Confirmation requires an idempotency key and live owned holds. The server calculates the total from catalog prices.
5. One MongoDB document saves the group and its pending email intent. A unique confirmed event/seat index prevents duplicate bookings.
6. The notification worker sends the QR attachment through SMTP and retries failed attempts.

The Redis inventory counter is advisory. Confirmed availability comes from MongoDB seat counts. Email delivery is at-least-once, so a crash near SMTP acknowledgement can cause a duplicate email.

## Checks

```sh
npm test
npm run build
npm run test:integration
```

Integration tests require the running services and demo admin account. They create temporary test records, test competing holds and checkout, verify email delivery, and remove their own database fixtures. Results go to the ignored `artifacts/` directory.

## Docker

```sh
docker compose up --build -d
```

Open http://localhost:8080. NGINX serves the frontend and routes API requests to the four services. MongoDB and Redis persist in named volumes. `docker compose down` stops the stack without deleting those volumes.

If the local gateway already occupies port 8080, use `GATEWAY_PORT=9080 docker compose up --build -d`.

## Documentation

- [Architecture and trade-offs](docs/ARCHITECTURE.md)
- [Deployment and environment variables](docs/DEPLOYMENT.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Schema diagram](docs/EventPass_Database_Schema.png)
- [Postman collection](docs/EventPass.postman_collection.json)
- [HTTP request examples](docs/api.http)
- [Assets](docs/ASSETS.md)

The mail service follows the Express/Nodemailer pattern from the [lecture example](https://github.com/pepleadgenius/micrsoervices_batch_friday_lab/tree/main/mailer_service), with a durable outbox, retry state and QR attachments.

## Current limits

Payment is mocked. Cancellation, refunds and admission scanning are not implemented. Local email is captured by Mailpit; external delivery needs an SMTP provider. Sessions are held in memory and reset on refresh. Vercel provides HTTPS and service hosting; large-scale load testing has not been completed. Third-party discovery requires a server-side Gemini key and sufficient Google Search quota. Provider checkout happens outside EventPass.
