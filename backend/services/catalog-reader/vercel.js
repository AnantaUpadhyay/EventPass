const express = require("express");
const catalog = require("../catalog-service/vercel");
const app = express();
// A read-only catalog replica keeps Vercel's service binding graph acyclic.
app.get("/api/catalog/events/:id", catalog);
app.use((req, res) => res.sendStatus(404));
module.exports = app;
