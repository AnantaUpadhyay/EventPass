# Lab evaluation: demonstration and viva guide

Certification is a separate completed task and is excluded here.

## Before the lab

1. Start Docker Desktop.
2. Run `npm install`, `npm run setup`, and `docker compose up -d mongo redis mailpit`.
3. Start `npm run dev` and open `http://localhost:3000`.
4. Open `http://localhost:8025` in a second tab for the captured ticket email.
5. Run `npm test`, `npm run build`, and `npm run test:integration`.
6. Keep `artifacts/integration-results.json`, this guide, and the database schema available.
7. For an actual NGINX demonstration, use `docker compose up --build -d` instead of the local service runner. If both stacks are needed, use `GATEWAY_PORT=9080 docker compose up --build -d`.

Do not claim capacity, latency or availability figures that you have not measured. The supplied design's 5,000-user flash-sale scenario is the problem statement, not a completed load test.

## 60-second project explanation


## Demonstration order: approximately 7 minutes

| Time | Show | Explain |
| --- | --- | --- |
| 0:00–0:45 | Discover page and system architecture | Problem, users, service boundaries, data ownership |
| 0:45–1:30 | Sign in and choose an event | JWT, bcrypt hashes, server-owned event metadata |
| 1:30–2:30 | Select a seat and hold | Redis Lua, NX lease, TTL, competing request gets 409 |
| 2:30–3:15 | Confirm and inspect QR ticket | Unique seat index, idempotency key, server-derived price, mock payment |
| 3:15–3:45 | Mailpit inbox | Actual SMTP, QR attachment, durable outbox and retries |
| 5:45–7:00 | System overview, schema tab, API tab | Independent services, indexes, live metrics, test evidence |

Use `student@college.edu` / `student123` for the student flow. Use `organizer@college.edu` / `student123` to demonstrate authorized event creation. These are local seeded accounts, not production credentials.

## Backend implementation progress

Implemented: four service responsibilities; independent servers and logical databases; JWT auth; role checks; event catalog and creation; cache-aside and version invalidation; valid-layout seat holds; atomic owner release; idempotent durable booking; generated QR tickets; embedded email outbox; SMTP worker with retry records and leases; local and NGINX gateways; health checks; Docker Compose; API examples; concurrency integration checks; responsive frontend.

Deliberately outside this semester demo: real payment gateway, refunds/cancellations, mobile admission-scanner application, managed production TLS/secrets, multi-node databases, and a quantified production capacity SLA.

## Useful commands

```sh

# Inspect services and database health.
docker compose ps
curl -s http://localhost:8080/api/health/booking

# Repeat actual correctness and endpoint checks.
npm run test:integration
```

For a Docker NGINX gateway on 9080, substitute that port. Integration tests create and clean up their own fixtures. Test emails remain visible in Mailpit.

## Questions worth preparing

**Why microservices?** Auth, catalog, booking, mail, and links have different data and workloads. Their boundaries allow independent processes and scaling. This is more operational work than a monolith, but useful for the course's distributed-systems objectives.

**Why Redis if MongoDB has a unique index?** Redis gives fast temporary ownership and auto-expiring leases. MongoDB's index provides durable final uniqueness. Neither replaces the other.

**Does SETNX alone guarantee no double booking?** No. Locks expire, clients retry, and processes crash. The confirmed-seat unique index is the final safeguard.

**What happens if the user closes the tab?** The frontend attempts a keepalive release. The lease expires even if that request never reaches the service.

**Why an idempotency key?** A client may lose a success response and retry. The same user/request pair returns the same ticket instead of creating another order.

**Where does the price come from?** The catalog service. Request-body prices and user IDs are ignored during confirmation.

**What if mail fails?** The ticket is already durable. An outbox entry survives restarts, and the worker retries. SMTP is at-least-once, so a crash near acknowledgement can duplicate a message.




**What does the inventory counter guarantee?** It is an advisory reservation count, reconciled from confirmed bookings and active hold entries. It is not a transaction spanning Redis and MongoDB. Durable seat uniqueness comes from MongoDB.

**What happens during a Redis outage?** New holds and confirmations fail closed rather than pretending a process-local Map is distributed. Existing saved tickets remain in MongoDB.

**Is the whole system CP?** Do not apply one CAP label to every endpoint. Booking prioritizes rejecting unsafe writes; browsing can remain readable with degraded availability. This deployment uses single-node dependencies and has not demonstrated a partition-tolerant quorum configuration.

**Is the QR code a payment receipt?** No. It encodes the booking ID and random ticket code for the mock project flow. No real money was collected.

## Reference

The supplied lecture [mailer service](https://github.com/pepleadgenius/micrsoervices_batch_friday_lab/tree/main/mailer_service) uses Nodemailer and SMTP. EventPass applies that same service responsibility with durable queue state, retry/backoff, request validation, and a captured development inbox. Never copy published credentials into this project.
