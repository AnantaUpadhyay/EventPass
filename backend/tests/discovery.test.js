const test = require("node:test");
const assert = require("node:assert/strict");
const {
  readResults,
  publicUrl,
  searchEvents,
} = require("../services/catalog-service/src/services/discovery");
function response(events, urls) {
  return {
    steps: [
      {
        type: "model_output",
        content: [
          {
            type: "text",
            text: JSON.stringify({ events }),
            annotations: urls.map((url) => ({ type: "url_citation", url })),
          },
        ],
      },
    ],
  };
}
const url = "https://in.bookmyshow.com/events/test-event/ET123";
const event = {
  title: "A sourced concert",
  venue: "Noida venue",
  date: "2026-12-01",
  category: "Concerts",
  url,
};
test("discovery accepts only dated, cited public listings and deduplicates URLs", () => {
  const input = [
    event,
    event,
    { ...event, url: "https://invented.example.com/event" },
    { ...event, date: "2026-01-01" },
    { ...event, date: "2027-12-01" },
    { ...event, date: "2026-02-30" },
    { ...event, url: "http://127.0.0.1/private" },
  ];
  const result = readResults(
    response(input, [url, "http://127.0.0.1/private"]),
    "2026-11-04",
  );
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].provider, "in.bookmyshow.com");
  assert.throws(
    () => readResults(response([event], []), "2026-11-04"),
    /Sources could not be confirmed/,
  );
  assert.deepEqual(readResults(response([], []), "2026-11-04").events, []);
});
test("discovery rejects executable URLs, private addresses and embedded credentials", () => {
  for (const value of [
    "javascript:alert(1)",
    "https://127.1/",
    "https://[::1]/",
    "https://localhost/",
    "https://server.internal/",
    "https://user:pass@example.com/",
  ])
    assert.equal(publicUrl(value), null);
});
test("Gemini requests enable grounded search and keep API keys out of URL and response", async () => {
  const data = await searchEvents(
    { city: "Noida", query: "concert", category: "Concerts" },
    {
      apiKey: "test-key",
      fetchImpl: async (endpoint, options) => {
        assert(!endpoint.includes("test-key"));
        assert.equal(options.headers["x-goog-api-key"], "test-key");
        const body = JSON.parse(options.body);
        assert.deepEqual(body.tools, [{ type: "google_search" }]);
        assert.equal(body.store, false);
        assert.equal(body.response_format.mime_type, "application/json");
        return {
          ok: true,
          json: async () =>
            response(
              [
                {
                  ...event,
                  date: new Date(Date.now() + 7 * 86400000)
                    .toISOString()
                    .slice(0, 10),
                },
              ],
              [url],
            ),
        };
      },
    },
  );
  assert.equal(data.events.length, 1);
  assert(!JSON.stringify(data).includes("test-key"));
  await assert.rejects(
    searchEvents(
      { city: "Noida", query: "", category: "All" },
      {
        apiKey: "test-key",
        fetchImpl: async () => ({ ok: false, status: 429 }),
      },
    ),
    (error) => error.status === 429,
  );
});
