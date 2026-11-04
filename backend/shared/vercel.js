const express = require("express");

// Each function instance shares one connection and index initialization promise.
module.exports = function vercelHandler(app, initialize) {
  let ready;
  const handler = express();
  handler.use(async (req, res) => {
    try {
      ready ||= initialize().catch((error) => {
        ready = undefined;
        throw error;
      });
      await ready;
      app(req, res);
    } catch (error) {
      console.error("Service initialization failed:", error.message);
      res
        .status(503)
        .json({ error: "Service is starting. Please retry shortly." });
    }
  });
  return handler;
};
