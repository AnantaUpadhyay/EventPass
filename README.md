# EventPass

**Good plans. Great memories.** A campus experience platform built with React, independently runnable Express services, MongoDB, Redis, SMTP, and a round-robin gateway.

Discover events, reserve a seat for ten minutes, confirm a mock checkout, and receive a QR ticket.. The system dashboard exposes actual service checks, process metrics, database schemas, and an interactive load-balancing demonstration.

## Run locally

Requirements: Node.js **22.12+**, npm, and Docker Desktop running.

```sh
npm install
npm run setup
docker compose up -d mongo redis mailpit
npm run dev
```

- App: http://localhost:3000
- Gateway: http://localhost:8080
- Captured email inbox: http://localhost:8025

`setup` creates `.env` with random JWT and internal-service secrets. It preserves an existing `.env`. Local demo seeding is enabled by default. MongoDB and Redis data persist in named Docker volumes.

| Account | Email | Password |
| --- | --- | --- |
| Student | student@college.edu | student123 |
| Organizer / admin | organizer@college.edu | student123 |

Use the organizer account to create an event. Public registration can create only students. The demo accounts exist only when `SEED_DEMO=true`; disable demo seeding before any public deployment.

## Run the entire stack in Docker

```sh
npm run setup
docker compose up --build -d
```

Open http://localhost:8080. This runs NGINX, four application services, MongoDB, Redis, and Mailpit. Local development instead uses a small Node gateway with the same routes.

Do not run both gateways on port 8080. To keep local development running while checking Docker:

```sh
GATEWAY_PORT=9080 docker compose up --build -d
```

Open http://localhost:9080. Stop containers with `docker compose down`; named database volumes remain intact. Avoid `down -v` unless you intend to erase local database data.

## Project structure

```text
client/                         React + Vite app and generated brand assets
  src/components/               Shared controls and printable QR ticket
  src/context/                  JWT session state
  src/pages/                    Discover, booking, tickets, links, dashboard, organizer
services/
  auth-service/                 Registration, bcrypt login, JWT profiles
  catalog-service/              Events, validation, Redis cache-aside
  booking-service/              Seat leases, idempotent booking, embedded mail outbox
  notification-service/         Durable SMTP worker, backoff and delivery records
  shortener-service/            URL CRUD, redirects, expiration, atomic click counts
  gateway/                      Local round-robin reverse proxy
shared/                         HTTP errors, authentication, DB and Redis setup, validation
infra/nginx.conf                Docker gateway and load balancer
scripts/                        Setup, local process runner, integration tests
tests/                         Focused validation and authentication tests
 docs/                          API requests, schemas, lab guide, generated asset prompts
```

Every service owns its database. Services communicate through HTTP and the authenticated internal outbox API. No production service directly reads another service's MongoDB collections.

## Verification

```sh
npm test
npm run build
npm run test:integration
```

The integration runner requires the running local stack and demo admin account. It creates disposable test users, an event and short links, then removes only its own MongoDB/Redis fixtures. Test email messages remain in Mailpit for inspection. Evidence is saved to `artifacts/integration-results.json`.

The checks cover authentication and authorization, cache hits, invalid seats, racing holds, concurrent checkouts, server-derived price and identity, idempotent retries, lease expiration and SMTP delivery. Configure `TEST_BASE=http://127.0.0.1:9080` to test the Docker gateway. Set `TEST_MONGO` if the test runner's MongoDB address differs from localhost.

## Key decisions

- **Durable correctness:** MongoDB's partial unique `(eventId, seatNumber)` index prevents two confirmed tickets for one seat. `(userId, requestId)` makes checkout retries idempotent.
- **Redis leases:** Lua atomically acquires a 600-second hold and coordinates advisory inventory. Confirmation requires a live owned hold and claims a short checkout lease. Release uses atomic compare-and-delete.
- **Fail closed:** There is no in-memory fallback pretending to be durable or distributed. Booking returns an error if Redis is unavailable. Services wait for database initialization before accepting requests.
- **Inventory:** Confirmed availability is derived from MongoDB booking counts. The Redis counter is advisory and reconciles expired holds on the next reservation. It is not a cross-database transaction or the final overselling safeguard.
- **Email:** A ticket and email intent are committed together in one booking document. The worker polls through an internal authenticated API, saves delivery attempts in its own database, uses worker leases, and retries with capped exponential backoff. SMTP delivery is at-least-once: a crash after SMTP acceptance can cause a duplicate email.

- **Catalog:** Static event metadata is cached for 3,600 seconds. A version key invalidates all list variants after creation. Live availability is added from the booking service and is `null` if that service is unavailable.
- **Payment:** Deliberately mocked. No card details or real money are collected.
- **Email environment:** Mailpit captures local SMTP messages. External SMTP requires your own provider configuration in `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`; no external mail account is configured.

## Design

Custom generated olive admission-ticket emblem, original concert/hackathon/workshop/esports photography, warm paper surfaces, muted stone accents, Instrument Sans and Newsreader, and an editorial serif. Generated images are local assets. Fonts are served locally with system fallbacks. Motion respects `prefers-reduced-motion`; screens adapt to mobile; dialogs trap focus and support Escape; tickets support browser print/save as PDF.

Generation prompts and file locations: [brand assets](docs/BRAND_ASSETS.md).

## Lab preparation

- [Lab demonstration and viva guide](docs/LAB_EVALUATION.md)
- [Implemented system design](EVENTPASS_SYSTEM_DESIGN.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Runnable HTTP examples](docs/api.http)
- [Postman collection](docs/EventPass.postman_collection.json)

The supplied [lecture mailer](https://github.com/pepleadgenius/micrsoervices_batch_friday_lab/tree/main/mailer_service) informed the Nodemailer/SMTP service boundary. This implementation adds JSON parsing, validation, a durable booking outbox, retries, QR attachments, and a local captured inbox. It does not copy credentials from that repository.

This is a complete local semester-project implementation, not a claim of audited production readiness or measured support for 5,000 concurrent users. TLS, managed secrets, distributed tracing, a multi-node Redis/Mongo deployment, real payments and production-scale load testing remain deployment work.
