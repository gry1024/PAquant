const assert = require("node:assert/strict");
const { describe, test } = require("node:test");
const { main } = require("./event.js");

const yahooPayload = {
  chart: {
    result: [
      {
        timestamp: [1782792000, 1782792300, 1782792600],
        indicators: {
          quote: [
            {
              open: [2336, 2337, 2338],
              high: [2338, 2339, 2340],
              low: [2335, 2336, 2337],
              close: [2337, 2338, 2339],
              volume: [10, 11, 12]
            }
          ]
        }
      }
    ]
  }
};

function fakeFetch(url) {
  const key = String(url);
  if (!key.includes("finance.yahoo.com")) {
    throw new Error(`unexpected fetch ${key}`);
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => yahooPayload });
}

describe("paquant CloudBase Event function", () => {
  test("routes service /api path to the live market endpoint", async () => {
    const response = await main(
      {
        httpMethod: "GET",
        path: "/api/market/xau/live",
        headers: {},
        queryStringParameters: {}
      },
      {},
      { fetchImpl: fakeFetch }
    );

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.equal(payload.source.id, "yahoo_gc_futures_proxy");
    assert.equal(payload.source.isMock, false);
    assert.equal(payload.quote.symbol, "XAUUSD");
  });

  test("decodes base64 request bodies before routing agent runs", async () => {
    const response = await main(
      {
        httpMethod: "POST",
        path: "/api/agent-runs",
        headers: { "content-type": "application/json" },
        body: Buffer.from(JSON.stringify({ modelProvider: "mock" }), "utf8").toString("base64"),
        isBase64Encoded: true
      },
      {},
      { fetchImpl: fakeFetch }
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /mock provider/);
  });
});
