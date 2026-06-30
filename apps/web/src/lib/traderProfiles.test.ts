import { describe, expect, test, vi } from "vitest";
import { loadTraderProfiles } from "./traderProfiles";
import type { TraderProfile } from "./workbenchTypes";

const apiProfile: TraderProfile = {
  id: "brooks-generalist",
  name: "Brooks Generalist",
  persona: "Balanced price-action simulator.",
  status: "active",
  symbol: "XAUUSD",
  timeframe: "5m",
  preferredSetups: ["always-in pullback"],
  riskStyle: "moderate",
  toolPermissions: ["find_swings", "draw_trendline", "measure_leg", "count_bars"],
  knowledgePolicy: "retrieve Brooks dossiers",
  agentFile: ".agents/traders/brooks-generalist.md",
  sharedKnowledgeFiles: [
    ".agents/common/price-action-core.md",
    ".agents/common/risk-control.md"
  ],
  sharedKnowledgeSummary: "Shared Price Action Core / Shared Risk Control",
  recentAction: "Reviewed XAU pullback.",
  performance: {
    equity: 10020,
    winRate: 1,
    maxDrawdown: 0,
    trades: 1,
    averageR: 2
  }
};

describe("loadTraderProfiles", () => {
  test("loads trader profiles from the local API", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ traders: [apiProfile] })
    })) as unknown as typeof fetch;

    const result = await loadTraderProfiles(fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/traders");
    expect(result).toHaveLength(1);
    expect(result[0].agentFile).toBe(".agents/traders/brooks-generalist.md");
    expect(result[0].recentAction).toBe("Reviewed XAU pullback.");
  });

  test("falls back to committed trader profiles when the API is unavailable", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    const result = await loadTraderProfiles(fetcher);

    expect(result.map((profile) => profile.id)).toEqual([
      "brooks-generalist",
      "always-in-trend",
      "second-entry",
      "best-trades-only",
      "trading-range-scalper",
      "breakout-pullback",
      "wedge-reversal",
      "breakout-failure",
      "major-reversal",
      "final-flag"
    ]);
    expect(result).toHaveLength(10);
    expect(result.find((profile) => profile.id === "wedge-reversal")?.status).toBe("research");
  });
});
