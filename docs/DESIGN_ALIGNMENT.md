# EventPass implementation against the supplied SVG

The reference is `eventpass_system_design.svg`. EventPass uses React, four Express services, MongoDB, Redis and NGINX. The URL shortener is a separate lab exercise.

Implemented: JWT held in React memory, bcrypt authentication, role checks, Redis cache-aside (one-hour default TTL), 600-second seat leases, atomic Lua inventory decrement and owned release, MongoDB unique confirmed seat constraints, QR tickets, durable asynchronous SMTP outbox, NGINX proxy routes and rate limiting. `/api/events` and `/api/book/` aliases match the diagram while existing API routes remain supported.

The Redis inventory counter is advisory. MongoDB uniqueness is the durable overselling safeguard. Ticket and email intent are saved atomically in a single booking document; this is not a cross-service multi-document transaction. Live availability uses booking counts rather than a second independently mutable event counter.

Local HTTP does not provide production TLS termination. One MongoDB node and one Redis node are configured. A quorum CP deployment, replicated application load test, 95% read-offload ratio and sub-2ms latency are not established by this implementation. Those diagram statements are targets, not measured results.

In-memory JWTs are cleared by refresh; users sign in again. Theme preferences remain persistent.

Seat clicks immediately acquire a Redis hold. Sign-out or navigation does not release the hold; only owner deselection, explicit release, confirmation or lease expiry changes availability. Other accounts see active holds as unavailable.
