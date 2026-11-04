const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const handler = require("../shared/vercel");

test("Vercel requests share initialization and retry after a failed connection", async () => {
  let attempts = 0;
  const app = express();
  app.get("/", (req, res) => res.json({ ready: true }));
  const server = handler(app, async () => {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (attempts === 1) throw new Error("Connection temporarily unavailable");
  }).listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(url)).status, 503);
    const responses = await Promise.all([fetch(url), fetch(url), fetch(url)]);
    assert(responses.every((response) => response.status === 200));
    assert.equal(attempts, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
