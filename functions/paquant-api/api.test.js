const assert = require("node:assert/strict");
const { describe, test } = require("node:test");
const { createAgentRun, handleRequest, loadLiveMarket } = require("./api.js");

const yahooPayload = {
  chart: {
    result: [
      {
        timestamp: Array.from({ length: 24 }, (_, index) => 1782786300 + index * 300),
        indicators: {
          quote: [
            {
              open: Array.from({ length: 24 }, (_, index) => 2317 + index),
              high: Array.from({ length: 24 }, (_, index) => 2319 + index),
              low: Array.from({ length: 24 }, (_, index) => 2316 + index),
              close: Array.from({ length: 24 }, (_, index) => 2318 + index),
              volume: Array.from({ length: 24 }, (_, index) => 10 + index)
            }
          ]
        }
      }
    ]
  }
};

function fakeFetch(responseByUrl) {
  return async (url, options = {}) => {
    const key = String(url);
    if (key.includes("finance.yahoo.com")) {
      return okJson(yahooPayload);
    }
    const value =
      typeof responseByUrl === "function" ? responseByUrl(url, options) : responseByUrl[key];
    if (!value) {
      throw new Error(`unexpected fetch ${key}`);
    }
    return okJson(value);
  };
}

function okJson(payload) {
  return { ok: true, status: 200, json: async () => payload };
}

describe("paquant CloudBase HTTP API", () => {
  test("loads non-mock live market metadata", async () => {
    const payload = await loadLiveMarket(fakeFetch({}));

    assert.equal(payload.source.id, "yahoo_gc_futures_proxy");
    assert.equal(payload.source.isMock, false);
    assert.equal(payload.source.isSpot, false);
    assert.equal(payload.candles.at(-1).close, 2341);
  });

  test("tries another real Yahoo chart endpoint when the first endpoint is rate limited", async () => {
    const requests = [];
    const payload = await loadLiveMarket(async (url, options = {}) => {
      requests.push({ url: String(url), headers: options.headers ?? {} });
      if (requests.length === 1) {
        return { ok: false, status: 429, json: async () => ({}) };
      }
      return okJson(yahooPayload);
    });

    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /query[12]\.finance\.yahoo\.com/);
    assert.match(requests[1].url, /query[12]\.finance\.yahoo\.com/);
    assert.notEqual(requests[0].url, requests[1].url);
    assert.match(requests[0].headers["User-Agent"], /Mozilla/);
    assert.equal(payload.source.isMock, false);
    assert.equal(payload.quote.price, 2341);
  });

  test("continues to another real market endpoint after a provider network error", async () => {
    const requests = [];
    const payload = await loadLiveMarket(async (url) => {
      requests.push(String(url));
      if (requests.length === 1) {
        throw new Error("network unavailable");
      }
      return okJson(yahooPayload);
    });

    assert.equal(requests.length, 2);
    assert.equal(payload.source.isMock, false);
    assert.equal(payload.quote.price, 2341);
  });

  test("uses the Jina Yahoo reader proxy when direct Yahoo chart endpoints are rate limited", async () => {
    const requests = [];
    const payload = await loadLiveMarket(async (url) => {
      const key = String(url);
      requests.push(key);
      if (key.includes("r.jina.ai")) {
        return {
          ok: true,
          status: 200,
          text: async () => `Title:\n\nMarkdown Content:\n${JSON.stringify(yahooPayload)}`
        };
      }
      return { ok: false, status: 429, json: async () => ({}) };
    });

    assert.equal(requests.length, 3);
    assert.match(requests[2], /r\.jina\.ai/);
    assert.equal(payload.source.id, "jina_yahoo_gc_futures_proxy");
    assert.equal(payload.source.isMock, false);
    assert.equal(payload.source.instrumentKind, "futures_proxy");
    assert.equal(payload.quote.price, 2341);
  });

  test("returns a real quote-only XAU payload when 5m chart providers are unavailable", async () => {
    const requests = [];
    const payload = await loadLiveMarket(async (url) => {
      const key = String(url);
      requests.push(key);
      if (key.includes("api.gold-api.com")) {
        return okJson({
          currency: "USD",
          name: "Gold",
          price: 3969.699951,
          symbol: "XAU",
          updatedAt: "2026-06-30T03:16:19Z"
        });
      }
      return { ok: false, status: 429, json: async () => ({}) };
    });

    assert.equal(requests.length, 4);
    assert.equal(payload.source.id, "gold_api_xau_spot_quote");
    assert.equal(payload.source.isMock, false);
    assert.equal(payload.source.isSpot, true);
    assert.equal(payload.source.instrumentKind, "spot_quote");
    assert.equal(payload.source.historyCompleteness, "latest_quote_only");
    assert.equal(payload.quote.price, 3969.699951);
    assert.equal(payload.candles.length, 1);
    assert.deepEqual(payload.candles[0], {
      timestamp: "2026-06-30T03:16:19.000Z",
      open: 3969.699951,
      high: 3969.699951,
      low: 3969.699951,
      close: 3969.699951,
      volume: 0,
      symbol: "XAUUSD",
      timeframe: "quote",
      body: 0,
      range: 0,
      close_position: 0.5
    });
  });

  test("rejects mock provider for agent runs", async () => {
    const response = await handleRequest({
      method: "POST",
      url: "/api/agent-runs",
      body: JSON.stringify({ modelProvider: "mock" }),
      fetchImpl: fakeFetch({})
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /mock provider/);
  });

  test("rejects live AI trading when only a quote-only market feed is available", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const response = await handleRequest({
      method: "POST",
      url: "/api/agent-runs",
      body: JSON.stringify({ modelProvider: "deepseek" }),
      fetchImpl: async (url) => {
        if (String(url).includes("api.gold-api.com")) {
          return okJson({
            currency: "USD",
            name: "Gold",
            price: 3969.699951,
            symbol: "XAU",
            updatedAt: "2026-06-30T03:16:19Z"
          });
        }
        return { ok: false, status: 429, json: async () => ({}) };
      }
    });

    assert.equal(response.statusCode, 409);
    assert.match(response.body, /full 5m candle history/);
  });

  test("agent run accepts browser-loaded ForexSB 5m candles instead of refetching market data", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const calls = [];
    const response = await handleRequest({
      method: "POST",
      url: "/api/agent-runs",
      body: JSON.stringify({
        traderId: "brooks-generalist",
        modelProvider: "deepseek",
        market: {
          source: {
            id: "forexsb_dukascopy_xauusd_m5_browser",
            label: "ForexSB Dukascopy XAUUSD M5 history",
            instrumentSymbol: "XAUUSD",
            instrumentKind: "spot_history",
            isSpot: true,
            isMock: false,
            historyCompleteness: "historical_5m",
            latency: "periodic_historical"
          },
          quote: {
            symbol: "XAUUSD",
            price: 3970.25,
            timestamp: "2026-06-30T04:15:00Z",
            providerSymbol: "XAU"
          },
          candles: clientCandles(24)
        }
      }),
      fetchImpl: async (url) => {
        calls.push(String(url));
        assert.match(String(url), /deepseek/);
        return okJson(modelResponse([
          {
            id: "draw",
            function: {
              name: "draw_trendline",
              arguments: JSON.stringify({
                id: "client-live-trendline",
                label: "Client 5m trend line",
                start: { time_index: 0, price: 3950 },
                end: { time_index: 23, price: 3972 }
              })
            }
          },
          {
            id: "measure",
            function: {
              name: "measure_leg",
              arguments: JSON.stringify({
                start: { time_index: 0, price: 3950 },
                end: { time_index: 23, price: 3972 }
              })
            }
          }
        ]));
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(calls.length, 1);
    const payload = JSON.parse(response.body);
    assert.equal(payload.meta.dataSource.id, "forexsb_dukascopy_xauusd_m5_browser");
    assert.equal(payload.candles.length, 24);
    assert.deepEqual(
      payload.chartObjects
        .filter((object) => object.kind === "trade_marker")
        .map((object) => object.marker_type),
      ["entry", "stop", "target"]
    );
    assert.equal(payload.orders[0].quantity, 1);
    assert.match(payload.orders[0].reason, /Real DeepSeek API returned tool calls/);
  });

  test("agent run rejects browser-loaded candles that are mock or too short", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const response = await handleRequest({
      method: "POST",
      url: "/api/agent-runs",
      body: JSON.stringify({
        modelProvider: "deepseek",
        market: {
          source: {
            id: "mock",
            label: "mock",
            instrumentSymbol: "XAUUSD",
            instrumentKind: "spot_history",
            isSpot: true,
            isMock: true,
            historyCompleteness: "historical_5m",
            latency: "test"
          },
          candles: clientCandles(10)
        }
      }),
      fetchImpl: async () => {
        throw new Error("model should not be called");
      }
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /non-mock 5m candles/);
  });

  test("agent run uses real provider tool calls and returns trade markers", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const modelResponses = [
      modelResponse([{ id: "swing", function: { name: "find_swings", arguments: "{}" } }]),
      modelResponse([
        {
          id: "draw",
          function: {
            name: "draw_trendline",
            arguments: JSON.stringify({
              id: "model-live-trendline",
              label: "Model live trend line",
              start: { time_index: 0, price: 2335 },
              end: { time_index: 4, price: 2341 }
            })
          }
        }
      ]),
      modelResponse([
        {
          id: "measure",
          function: {
            name: "measure_leg",
            arguments: JSON.stringify({
              start: { time_index: 0, price: 2337 },
              end: { time_index: 4, price: 2341 }
            })
          }
        }
      ])
    ];
    let modelCallIndex = 0;

    const payload = await createAgentRun({
      traderId: "brooks-generalist",
      modelProvider: "deepseek",
      fetchImpl: fakeFetch((url) => {
        if (String(url).includes("deepseek")) {
          const response = modelResponses[modelCallIndex];
          modelCallIndex += 1;
          return response;
        }
        return null;
      })
    });

    assert.equal(payload.analysis.modelUsage.provider, "deepseek");
    assert.deepEqual(
      payload.agentActions.map((action) => action.tool),
      ["find_swings", "draw_trendline", "measure_leg"]
    );
    const markerTypes = payload.chartObjects
      .filter((object) => object.kind === "trade_marker")
      .map((object) => object.marker_type);
    assert.deepEqual(markerTypes, ["entry", "stop", "target"]);
    assert.equal(payload.orders[0].quantity, 1);
    assert.match(payload.orders[0].reason, /Real DeepSeek API returned tool calls/);
  });
});

function modelResponse(toolCalls) {
  return {
    choices: [{ message: { content: "Model reasoning summary.", tool_calls: toolCalls } }],
    usage: { prompt_tokens: 100, completion_tokens: 20 }
  };
}

function clientCandles(count) {
  return Array.from({ length: count }, (_, index) => {
    const open = 3950 + index * 0.7;
    const close = open + (index % 2 === 0 ? 0.5 : -0.25);
    const high = Math.max(open, close) + 1;
    const low = Math.min(open, close) - 1;
    const range = high - low;
    return {
      timestamp: new Date(Date.UTC(2026, 5, 30, 0, index * 5)).toISOString(),
      symbol: "XAUUSD",
      timeframe: "5m",
      open,
      high,
      low,
      close,
      volume: 10 + index,
      body: Math.abs(close - open),
      range,
      close_position: (close - low) / range
    };
  });
}
