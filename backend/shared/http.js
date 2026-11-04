const express = require("express");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("node:crypto");
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32)
  throw new Error(
    "JWT_SECRET must contain at least 32 characters. Run npm run dev for local configuration.",
  );
const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, message) => Object.assign(new Error(message), { status });
function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new Error();
    req.user = jwt.verify(token, SECRET, {
      algorithms: ["HS256"],
      issuer: "eventpass",
      audience: "eventpass-web",
    });
    next();
  } catch {
    next(fail(401, "Please sign in to continue."));
  }
}
const admin = (req, res, next) =>
  req.user?.role === "admin"
    ? next()
    : next(fail(403, "Administrator access required."));
function internal(req, res, next) {
  const { timingSafeEqual } = require("node:crypto");
  const expected = Buffer.from(process.env.INTERNAL_API_KEY || "");
  const actual = Buffer.from(req.headers["x-internal-key"] || "");
  if (
    !expected.length ||
    actual.length !== expected.length ||
    !timingSafeEqual(expected, actual)
  )
    return next(fail(403, "Internal service access required."));
  next();
}
function createApp(name, dependencies = () => ({})) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set({
      "X-Request-Id": req.requestId,
      "X-Instance-Id": process.env.INSTANCE_ID || name,
      "X-Content-Type-Options": "nosniff",
    });
    next();
  });
  app.use(express.json({ limit: "32kb" }));
  app.get("/health", (req, res) => {
    const deps = dependencies();
    const ready = Object.values(deps).every(Boolean);
    res.status(ready ? 200 : 503).json({
      service: name,
      instance: process.env.INSTANCE_ID || name,
      status: ready ? "UP" : "DEGRADED",
      dependencies: deps,
      uptime: Math.floor(process.uptime()),
    });
  });
  return app;
}
function errors(app) {
  app.use((req, res, next) => next(fail(404, "Endpoint not found.")));
  app.use((err, req, res, next) => {
    const status =
      err.status ||
      (err.code === 11000
        ? 409
        : err.name === "ValidationError" ||
            err.name === "CastError" ||
            err.type === "entity.parse.failed"
          ? 400
          : 500);
    if (status >= 500) console.error(`[${req.requestId}]`, err.message);
    res.status(status).json({
      error:
        status === 500
          ? "Service unavailable. Please try again."
          : err.code === 11000
            ? "This record already exists."
            : err.message,
      requestId: req.requestId,
    });
  });
  return app;
}
function sign(user) {
  return jwt.sign(
    {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      universityId: user.universityId || null,
    },
    SECRET,
    {
      algorithm: "HS256",
      expiresIn: "24h",
      issuer: "eventpass",
      audience: "eventpass-web",
    },
  );
}
async function serviceFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(process.env.VERCEL ? 15000 : 5000),
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": process.env.INTERNAL_API_KEY,
      ...options.headers,
    },
  });
  if (!res.ok)
    throw fail(
      res.status === 404 ? 404 : 503,
      res.status === 404
        ? "Event not found."
        : "A required service is unavailable.",
    );
  return res.json();
}
module.exports = {
  asyncRoute,
  fail,
  auth,
  admin,
  internal,
  createApp,
  errors,
  sign,
  serviceFetch,
};
