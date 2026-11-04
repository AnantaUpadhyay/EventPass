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

## Third-party discovery

Configure `GEMINI_API_KEY` as a server-only secret for Production and Preview. `GEMINI_MODEL` defaults to `gemini-3.8-flash`; choose another currently supported Search-grounding model only after checking Google's documentation. The catalog service calls Google's Interactions API with Google Search and structured output. A live provider call must be checked after key setup; unit fixtures do not establish live search availability.

`GET /api/catalog/discovery/options` lists supported cities and categories. Authenticated `GET /api/catalog/discovery?city=Noida&q=music&category=All` returns externally hosted event listings. Choosing a city starts the search automatically; name searches submit explicitly.

Only public HTTPS URLs present in Google's citation annotations are returned. Entries without a real calendar date in the next 60 days or a venue are dropped, and duplicate URLs are removed. This does not independently verify availability or establish a partnership with the source. Booking and payment occur on the provider's website. Google search suggestions are shown in a sandboxed frame without script access.

Redis caches each city/query/category for 15 minutes and coordinates searches across instances. Fresh searches are limited to five per user per minute and 30 globally per UTC day by default. `DISCOVERY_DAILY_LIMIT` can change the daily limit (maximum 1000). A request consumes budget before calling Google; failed requests also count. Configure Google-side billing quotas separately. No API key is exposed to the browser.
