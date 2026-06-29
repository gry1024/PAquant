import { describe, expect, test, vi } from "vitest";
import fixtureData from "../fixtures/paquant-demo.json";
import { loadWorkbenchFixture } from "./workbenchData";
import type { WorkbenchFixture } from "./workbenchTypes";

const fixture = fixtureData as WorkbenchFixture;

describe("loadWorkbenchFixture", () => {
  test("loads the workbench payload from the local API", async () => {
    const apiPayload: WorkbenchFixture = {
      ...fixture,
      meta: {
        source: "api",
        symbol: "XAUUSD",
        timeframe: "5m",
        traderId: "brooks-generalist"
      }
    };
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => apiPayload
    })) as unknown as typeof fetch;

    const result = await loadWorkbenchFixture(fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/workbench/demo");
    expect(result.meta?.source).toBe("api");
    expect(result.candles.length).toBe(fixture.candles.length);
  });

  test("falls back to the committed fixture when the API is unavailable", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    const result = await loadWorkbenchFixture(fetcher);

    expect(result.meta?.source).toBe("fixture");
    expect(result.analysis.traderId).toBe("brooks-generalist");
    expect(result.chartObjects.length).toBeGreaterThan(0);
  });
});
