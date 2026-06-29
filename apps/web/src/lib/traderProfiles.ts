import type { TraderProfile } from "./workbenchTypes";

const API_TRADERS_URL = "/api/traders";

const fallbackProfiles: TraderProfile[] = [
  {
    id: "brooks-generalist",
    name: "Brooks Generalist",
    persona: "Balanced price-action simulator that checks context before setup labels.",
    status: "active",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["always-in pullback", "second entry", "failed breakout", "three pushes"],
    riskStyle: "moderate; one unit risk after context and trader equation checks",
    toolPermissions: [
      "find_swings",
      "draw_trendline",
      "draw_channel",
      "draw_box",
      "draw_fibonacci",
      "measure_leg",
      "compare_legs",
      "count_bars",
      "project_line",
      "measure_deviation",
      "snap_to_swing"
    ],
    knowledgePolicy: "retrieve concept graph, setup dossiers, and similar failure cases",
    recentAction: "Reviewed XAU 5m pullback thesis and submitted a simulated limit order.",
    performance: {
      equity: 10020,
      winRate: 1,
      maxDrawdown: 0,
      trades: 1,
      averageR: 2
    }
  },
  {
    id: "always-in-trend",
    name: "Always-In Trend Trader",
    persona: "Tracks always-in direction, urgency, pullback quality, and trend resumption.",
    status: "standby",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["always-in pullback", "micro channel", "trend resumption"],
    riskStyle: "trend-following; wider stops only after strong context confirmation",
    toolPermissions: [
      "find_swings",
      "draw_trendline",
      "draw_channel",
      "draw_box",
      "draw_fibonacci",
      "measure_leg",
      "compare_legs",
      "count_bars",
      "project_line",
      "measure_deviation",
      "snap_to_swing"
    ],
    knowledgePolicy: "prefer trend, channel, always-in, and strong trend playbooks",
    recentAction: "Waiting for a clean always-in long or short transition.",
    performance: {
      equity: 10000,
      winRate: 0,
      maxDrawdown: 0,
      trades: 0,
      averageR: 0
    }
  },
  {
    id: "best-trades-only",
    name: "Best-Trades-Only Conservative Trader",
    persona: "Filters aggressively and accepts no-trade decisions when trader equation is thin.",
    status: "standby",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["high 2 pullback", "low 2 pullback", "major trend reversal"],
    riskStyle: "conservative; small position unless probability and reward are clear",
    toolPermissions: [
      "find_swings",
      "draw_trendline",
      "draw_channel",
      "draw_box",
      "draw_fibonacci",
      "measure_leg",
      "compare_legs",
      "count_bars",
      "project_line",
      "measure_deviation",
      "snap_to_swing"
    ],
    knowledgePolicy: "retrieve trader equation, signal bar quality, and failure mode cases",
    recentAction: "Rejected marginal pullback because signal quality was mixed.",
    performance: {
      equity: 10000,
      winRate: 0,
      maxDrawdown: 0,
      trades: 0,
      averageR: 0
    }
  },
  {
    id: "trading-range-scalper",
    name: "Trading Range Scalper",
    persona: "Treats ranges as uncertainty and favors buy-low/sell-high tests.",
    status: "standby",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["range fade", "failed breakout", "micro double top or bottom"],
    riskStyle: "scalping; fast exits and reduced size near range midline",
    toolPermissions: [
      "find_swings",
      "draw_trendline",
      "draw_channel",
      "draw_box",
      "draw_fibonacci",
      "measure_leg",
      "compare_legs",
      "count_bars",
      "project_line",
      "measure_deviation",
      "snap_to_swing"
    ],
    knowledgePolicy: "prefer trading range, failed breakout, and support/resistance cases",
    recentAction: "Monitoring whether the current channel becomes a mature trading range.",
    performance: {
      equity: 10000,
      winRate: 0,
      maxDrawdown: 0,
      trades: 0,
      averageR: 0
    }
  },
  {
    id: "wedge-reversal",
    name: "Wedge/Reversal Specialist",
    persona: "Studies three pushes, overshoots, undershoots, momentum loss, and reversal risk.",
    status: "research",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["wedge reversal", "three pushes", "final flag"],
    riskStyle: "reversal; requires clear invalidation and confirmation after exhaustion",
    toolPermissions: [
      "find_swings",
      "draw_trendline",
      "draw_channel",
      "draw_box",
      "draw_fibonacci",
      "measure_leg",
      "compare_legs",
      "count_bars",
      "project_line",
      "measure_deviation",
      "snap_to_swing"
    ],
    knowledgePolicy: "prefer wedge, three-push, final flag, and momentum-change cases",
    recentAction: "Tagging three-push candidates but waiting for clearer signal bars.",
    performance: {
      equity: 10000,
      winRate: 0,
      maxDrawdown: 0,
      trades: 0,
      averageR: 0
    }
  },
  {
    id: "breakout-failure",
    name: "Breakout and Failed Breakout Trader",
    persona: "Evaluates breakout strength, follow-through, trapped traders, and failure entries.",
    status: "research",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["breakout pullback", "failed breakout", "measured move"],
    riskStyle: "event-driven; size depends on breakout follow-through and stop distance",
    toolPermissions: [
      "find_swings",
      "draw_trendline",
      "draw_channel",
      "draw_box",
      "draw_fibonacci",
      "measure_leg",
      "compare_legs",
      "count_bars",
      "project_line",
      "measure_deviation",
      "snap_to_swing"
    ],
    knowledgePolicy: "prefer breakout, failure, measured move, and trader trap cases",
    recentAction: "Comparing breakout follow-through against measured move targets.",
    performance: {
      equity: 10000,
      winRate: 0,
      maxDrawdown: 0,
      trades: 0,
      averageR: 0
    }
  }
];

export async function loadTraderProfiles(
  fetcher: typeof fetch = globalThis.fetch
): Promise<TraderProfile[]> {
  try {
    const response = await fetcher(API_TRADERS_URL);
    if (!response.ok) {
      throw new Error(`PAquant API returned ${response.status}`);
    }
    const payload = (await response.json()) as { traders?: TraderProfile[] };
    if (!payload.traders?.length) {
      throw new Error("PAquant API returned no trader profiles");
    }
    return payload.traders;
  } catch {
    return fallbackProfiles;
  }
}
