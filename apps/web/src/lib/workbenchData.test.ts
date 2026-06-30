import { describe, expect, test, vi } from "vitest";
import fixtureData from "../fixtures/paquant-demo.json";
import { loadWorkbenchFixture, resolveApiUrl, startAgentRun } from "./workbenchData";
import type { WorkbenchFixture } from "./workbenchTypes";

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
});
