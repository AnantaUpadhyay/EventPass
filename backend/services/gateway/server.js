const express = require("express");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const app = express();
app.disable("x-powered-by");
const services = {
  auth: process.env.AUTH_URL || "http://127.0.0.1:5001",
  catalog: process.env.CATALOG_URL || "http://127.0.0.1:5002",
  booking: process.env.BOOKING_URL || "http://127.0.0.1:5003",
  notifications: process.env.NOTIFICATION_URL || "http://127.0.0.1:5004",
};
app.get("/api/health/:name", async (req, res) => {
  const url = services[req.params.name];
  if (!url) return res.status(404).json({ error: "Unknown service." });
  try {
    const response = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    res.status(response.status).json(await response.json());
  } catch {
    res.status(503).json({ service: req.params.name, status: "DOWN" });
  }
});
app.get("/health", (req, res) =>
  res.json({ service: "gateway", status: "UP", instance: "gateway" }),
);
app.get("/api/system", async (req, res) => {
  const targets = Object.entries(services);
  const statuses = await Promise.all(
    targets.map(async ([name, url]) => {
      try {
        const response = await fetch(`${url}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        return { name, ...(await response.json()), reachable: true };
      } catch {
        return { name, status: "DOWN", reachable: false };
      }
    }),
  );
  res
    .set("Cache-Control", "no-store")
    .json({
      gateway: process.env.VERCEL ? "vercel-services" : "local-round-robin",
      services: statuses,
    });
});
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  req.url = req.url
    .replace(/^\/api\/events(?=\/|\?|$)/, "/api/catalog/events")
    .replace(/^\/api\/book(?=\/|\?|$)/, "/api/booking");
  const match = req.path.match(
    /^\/api\/(auth|catalog|booking|notifications)(\/|$)/,
  );
  if (!match) return next();
  const target = new URL(services[match[1]]);
  const transport = target.protocol === "https:" ? https : http;
  const upstream = transport.request(
    {
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,
        "x-forwarded-for": req.socket.remoteAddress,
      },
    },
    (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    },
  );
  upstream.setTimeout(15000, () =>
    upstream.destroy(new Error("Upstream timeout")),
  );
  upstream.on("error", () => {
    if (!res.headersSent)
      res
        .status(502)
        .json({ error: "A service is offline. Please retry shortly." });
    else res.end();
  });
  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
});
app.use("/internal", (req, res) => res.sendStatus(404));
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Endpoint not found." }),
);
const staticPath = path.resolve(__dirname, "../../../frontend/dist");
app.use(express.static(staticPath));
app.get("*", (req, res) => res.sendFile(path.join(staticPath, "index.html")));
if (require.main === module) {
  app.listen(process.env.PORT || 8080, () =>
    console.log("Gateway ready on http://localhost:8080"),
  );
}
module.exports = app;
