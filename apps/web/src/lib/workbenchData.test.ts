import { describe, expect, test, vi } from "vitest";
import fixtureData from "../fixtures/paquant-demo.json";
import {
  loadForexsbXauUsd5mCandles,
  loadWorkbenchFixture,
  parseForexsbXauUsd5m,
  resolveApiUrl,
  startAgentRun
} from "./workbenchData";
import type { Candle, WorkbenchFixture } from "./workbenchTypes";

const fixture = fixtureData as WorkbenchFixture;

describe("loadWorkbenchFixture", () => {
  test("uses the CloudBase HTTP service API when hosted on CloudBase static hosting", () => {
    expect(
      resolveApiUrl(
        "/market/xau/live",
        "https://paquant-groy-env-d5g7okht7dcd202fe.webapps.tcloudbase.com/"
      )
    ).toBe(
      "https://groy-env-d5g7okht7dcd202fe-1401196005.ap-shanghai.app.tcloudbase.com/api/market/xau/live"
    );
  });

  test("uses the local Vite proxy API outside CloudBase static hosting", () => {
    expect(resolveApiUrl("/market/xau/live", "http://localhost:5173/")).toBe(
      "/api/market/xau/live"
    );
  });

  test("loads live market data instead of demo fixture data", async () => {
    const livePayload = {
      source: {
        id: "goldapi_spot",
        label: "GoldAPI spot XAU/USD",
        instrumentSymbol: "XAUUSD",
        instrumentKind: "spot",
        isSpot: true,
        isMock: false,
        latency: "live"
      },
      quote: {
        symbol: "XAUUSD",
        price: 2338.2,
        timestamp: "2026-06-30T04:30:00Z",
        providerSymbol: "XAU/USD"
      },
      candles: fixture.candles.slice(0, 12).map((candle, index) => ({
        ...candle,
        close: 2330 + index
      }))
    };
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => livePayload
    })) as unknown as typeof fetch;

    const result = await loadWorkbenchFixture(fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/market/xau/live");
    expect(result.meta?.source).toBe("live");
    expect(result.meta?.dataSource?.isMock).toBe(false);
    expect(result.meta?.dataSource?.isSpot).toBe(true);
    expect(result.candles).toHaveLength(12);
    expect(result.candles[11].close).toBe(2341);
  });

  test("uses browser-loaded ForexSB Dukascopy XAUUSD M5 candles when available", async () => {
    const livePayload = {
      source: {
        id: "gold_api_xau_spot_quote",
        label: "Gold API XAU/USD realtime spot quote",
        instrumentSymbol: "XAU",
        instrumentKind: "spot_quote",
        isSpot: true,
        isMock: false,
        historyCompleteness: "latest_quote_only",
        latency: "realtime_quote"
      },
      quote: {
        symbol: "XAUUSD",
        price: 3970.25,
        timestamp: "2026-06-30T04:30:00Z",
        providerSymbol: "XAU"
      },
      candles: [fixture.candles[0]]
    };
    const raw = forexsbBuffer(30);
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/market/xau/live") {
        return { ok: true, json: async () => livePayload };
      }
      if (url.includes("data.forexsb.com")) {
        return { ok: true, arrayBuffer: async () => raw };
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as unknown as typeof fetch;

    const result = await loadWorkbenchFixture(fetcher);

    expect(result.meta?.dataSource?.id).toBe("forexsb_dukascopy_xauusd_m5_browser");
    expect(result.meta?.dataSource?.isMock).toBe(false);
    expect(result.meta?.dataSource?.historyCompleteness).toBe("historical_5m");
    expect(result.meta?.quote?.price).toBe(3970.25);
    expect(result.candles).toHaveLength(30);
    expect(result.candles[0].timestamp).toBe("2026-06-30T00:00:00.000Z");
    expect(result.candles[29].close).toBe(3974.85);
  });

  test("keeps the browser ForexSB download alive long enough for the public preview", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const raw = forexsbBuffer(30);
      const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal as AbortSignal | undefined;
        return {
          ok: true,
          arrayBuffer: async () => {
            await new Promise((resolve) => globalThis.setTimeout(resolve, 10_000));
            return raw;
          }
        };
      }) as unknown as typeof fetch;

      const candlesPromise = loadForexsbXauUsd5mCandles(fetcher, 30);
      await vi.advanceTimersByTimeAsync(10_000);

      await expect(candlesPromise).resolves.toHaveLength(30);
      expect(signal?.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("does not block on browser ForexSB when the live API already has 5m candles", async () => {
    const livePayload = {
      source: {
        id: "local_sample_xauusd_5m_fallback",
        label: "本地 XAUUSD 5分钟回放样本（实时行情源不可用）",
        instrumentSymbol: "XAUUSD",
        instrumentKind: "sample_replay",
        isSpot: true,
        isMock: false,
        latency: "local_replay"
      },
      quote: {
        symbol: "XAUUSD",
        price: 2338.2,
        bid: 2337.85,
        ask: 2338.55,
        timestamp: "2026-06-30T04:30:00Z",
        providerSymbol: "XAUUSD"
      },
      candles: fixture.candles.slice(0, 24)
    };
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) !== "/api/market/xau/live") {
        throw new Error(`unexpected fetch ${String(input)}`);
      }
      return { ok: true, json: async () => livePayload };
    }) as unknown as typeof fetch;

    const result = await loadWorkbenchFixture(fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.meta?.dataSource?.id).toBe("local_sample_xauusd_5m_fallback");
    expect(result.candles).toHaveLength(24);
  });

  test("does not fall back to committed fixture when live market API is unavailable", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    await expect(loadWorkbenchFixture(fetcher)).rejects.toThrow("offline");
  });

  test("does not fall back to mock analysis when agent run fails", async () => {
    const fetcher = vi.fn(async () => ({
      ok: false,
      json: async () => ({ detail: "model provider deepseek is not configured; set DEEPSEEK_API_KEY" })
    })) as unknown as typeof fetch;

    await expect(
      startAgentRun({ traderId: "brooks-generalist", modelProvider: "deepseek" }, fetcher)
    ).rejects.toThrow("DEEPSEEK_API_KEY");
  });

  test("sends the visible market candles when starting the AI trader", async () => {
    const candles = fixture.candles.slice(0, 24) as Candle[];
    let body: unknown;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return { ok: true, json: async () => fixture };
    }) as unknown as typeof fetch;

    await startAgentRun(
      {
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
            latency: "browser_direct"
          },
          quote: {
            symbol: "XAUUSD",
            price: 3970.25,
            timestamp: "2026-06-30T04:30:00Z",
            providerSymbol: "XAU"
          },
          candles
        }
      },
      fetcher
    );

    expect(body).toMatchObject({
      traderId: "brooks-generalist",
      modelProvider: "deepseek",
      market: {
        source: { id: "forexsb_dukascopy_xauusd_m5_browser", isMock: false },
        quote: { price: 3970.25 },
        candles: expect.arrayContaining([expect.objectContaining({ timeframe: "5m" })])
      }
    });
  });

  test("parses ForexSB little-endian M5 records into normalized candles", () => {
    const candles = parseForexsbXauUsd5m(forexsbBuffer(3), 2);

    expect(candles).toHaveLength(2);
    expect(candles[0]).toMatchObject({
      timestamp: "2026-06-30T00:05:00.000Z",
      symbol: "XAUUSD",
      timeframe: "5m",
      open: 3960.5,
      high: 3962,
      low: 3959.7,
      close: 3960.85,
      volume: 6
    });
    expect(candles[0].body).toBeCloseTo(0.35);
    expect(candles[0].range).toBeCloseTo(2.3);
  });
});

function forexsbBuffer(count: number): ArrayBuffer {
  const recordSize = 28;
  const buffer = new ArrayBuffer(recordSize * count);
  const view = new DataView(buffer);
  const startMinutes = Date.UTC(2026, 5, 30, 0, 0) / 60_000 - Date.UTC(2000, 0, 1) / 60_000;
  for (let index = 0; index < count; index += 1) {
    const offset = index * recordSize;
    const open = 3960 + index * 0.5;
    const close = open + 0.35;
    const high = open + 1.5;
    const low = open - 0.8;
    view.setInt32(offset, startMinutes + index * 5, true);
    view.setInt32(offset + 4, Math.round(open * 1000), true);
    view.setInt32(offset + 8, Math.round(high * 1000), true);
    view.setInt32(offset + 12, Math.round(low * 1000), true);
    view.setInt32(offset + 16, Math.round(close * 1000), true);
    view.setInt32(offset + 20, 5 + index, true);
    view.setInt32(offset + 24, 650, true);
  }
  return buffer;
}
