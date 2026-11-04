# Vercel deployment

The root `vercel.json` deploys the Vite frontend, gateway and four backend services together using Vercel Services (beta). Only the frontend and gateway have public ingress. Backend calls use private service bindings and internal API authentication.

Set these Vercel environment variables before deploying:

- `MONGO_URI`: MongoDB Atlas connection string. The Atlas user needs access to the `eventpass_auth`, `eventpass_catalog`, `eventpass_booking` and `eventpass_notifications` databases. Configure Atlas network access for the hosting environment.
- `REDIS_URL`: a TLS Redis TCP connection string (`rediss://`), not an HTTP REST endpoint. Seat coordination requires the Redis Lua commands used by the booking service.
- `JWT_SECRET`, `INTERNAL_API_KEY`, `CRON_SECRET`: independent random secrets.
- `SEED_DEMO=false`: never create the local demo administrator publicly.
- `SEED_CATALOG=true`: insert the four initial event listings when absent.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: configure a real mail provider. Local Mailpit is unavailable from Vercel.

The Vercel entrypoints initialize database connections and indexes once per function instance. MongoDB databases remain separated by service. The ordinary `server.js` entrypoints still run the local/Docker services.

A private read-only catalog replica reuses the catalog implementation for booking lookups. This avoids a cycle between catalog availability counts and booking event lookups; Vercel rejects cyclic service bindings.

After a confirmed booking, the gateway uses Vercel `waitUntil` invokes the authenticated notification processor. The durable outbox is retained if dispatch fails. A daily authenticated cron retries outstanding messages; the Vercel deployment does not run the local three-second worker loop. Email retries can therefore be delayed during provider outages. For frequent automatic retries, use a dedicated worker or a more frequent scheduler supported by your hosting plan.

Verify the public deployment before relying on it: catalog search, signup/login, two-account seat exclusion, confirmation, ticket retrieval and real email delivery. Local integration checks use isolated test accounts and remove their test data.
