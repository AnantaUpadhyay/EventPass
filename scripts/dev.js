const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
process.chdir(path.resolve(__dirname, ".."));
if (!fs.existsSync(".env")) {
  fs.writeFileSync(
    ".env",
    `JWT_SECRET=${randomBytes(48).toString("hex")}\nINTERNAL_API_KEY=${randomBytes(32).toString("hex")}\nSEED_DEMO=true\n`,
    { mode: 0o600 },
  );
  console.log("Created local .env with random service secrets.");
}
process.loadEnvFile(".env");
const children = [];
function run(name, cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (data) => process.stdout.write(`[${name}] ${data}`));
  child.on("exit", (code) => {
    if (code && !stopping) {
      console.error(
        `${name} exited (${code}). Start infrastructure: docker compose up -d mongo redis mailpit`,
      );
      shutdown(code);
    }
  });
  children.push(child);
}
let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill("SIGTERM"));
  setTimeout(() => process.exit(code), 1500).unref();
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => shutdown());
for (const [name, port, env] of [
  ["auth-service", 5001, {}],
  ["catalog-service", 5002, {}],
  ["booking-service", 5003, {}],
  ["notification-service", 5004, {}],
  ["gateway", 8080, {}],
])
  run(
    `${name}:${port}`,
    process.execPath,
    [`backend/services/${name}/server.js`],
    { PORT: String(port), ...env },
  );
if (
  !process.argv.includes("--production") &&
  !process.argv.includes("--backend-only")
)
  run("frontend", "npm", ["--workspace", "frontend", "run", "dev"]);
console.log(
  "EventPass: http://localhost:3000 · Gateway: http://localhost:8080 · Mail inbox: http://localhost:8025",
);
