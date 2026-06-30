import fixtureData from "../fixtures/paquant-demo.json";
import type {
  LiveMarketPayload,
  ModelProviderChoice,
  WorkbenchFixture,
  WorkbenchMeta
} from "./workbenchTypes";

const API_LIVE_MARKET_URL = "/api/market/xau/live";
const API_MODEL_PROVIDERS_URL = "/api/model-providers";
const API_AGENT_RUNS_URL = "/api/agent-runs";
const fixture = fixtureData as WorkbenchFixture;
const fallbackProviders: ModelProviderChoice[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    model: "deepseek-chat",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    available: false,
    capabilities: {
      text: true,
      vision: false,
      structured_output: true,
      tool_calling: true,
      context_window: 64000
    }
  },
  {
    id: "qwen",
    name: "Qwen",
    model: "qwen-plus",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    available: false,
    capabilities: {
      text: true,
      vision: true,
      structured_output: true,
      tool_calling: true,
      context_window: 128000
    }
  },
  {
    id: "minimax",
    name: "MiniMax",
    model: "MiniMax-M1",
    apiKeyEnv: "MINIMAX_API_KEY",
    available: false,
    capabilities: {
      text: true,
      vision: false,
      structured_output: true,
      tool_calling: true,
      context_window: 80000
    }
  },
  {
    id: "kimi",
    name: "Kimi",
    model: "moonshot-v1-128k",
    apiKeyEnv: "MOONSHOT_API_KEY",
    available: false,
    capabilities: {
      text: true,
      vision: false,
      structured_output: true,
      tool_calling: true,
      context_window: 128000
    }
  }
];

export async function loadWorkbenchFixture(
  fetcher: typeof fetch = globalThis.fetch
): Promise<WorkbenchFixture> {
  const response = await fetcher(API_LIVE_MARKET_URL);
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return workbenchFromLiveMarket((await response.json()) as LiveMarketPayload);
}

export async function loadModelProviders(
  fetcher: typeof fetch = globalThis.fetch
): Promise<ModelProviderChoice[]> {
  try {
    const response = await fetcher(API_MODEL_PROVIDERS_URL);
    if (!response.ok) {
      throw new Error(`PAquant API returned ${response.status}`);
    }
    const payload = (await response.json()) as { providers: ModelProviderChoice[] };
    return payload.providers;
  } catch {
    return fallbackProviders;
  }
}

export async function startAgentRun(
  {
    traderId,
    modelProvider
  }: {
    traderId: string;
    modelProvider: string;
  },
  fetcher: typeof fetch = globalThis.fetch
): Promise<WorkbenchFixture> {
  const response = await fetcher(API_AGENT_RUNS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ traderId, modelProvider })
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as WorkbenchFixture;
}

function liveMeta(payload: LiveMarketPayload): WorkbenchMeta {
  return {
    source: "live",
    symbol: "XAUUSD",
    timeframe: "5m",
    traderId: "brooks-generalist",
    agentStatus: "idle",
    dataSource: payload.source,
    quote: payload.quote
  };
}

function workbenchFromLiveMarket(payload: LiveMarketPayload): WorkbenchFixture {
  return {
    ...fixture,
    meta: liveMeta(payload),
    candles: payload.candles,
    higherTimeframeContext: [],
    agentActions: [],
    chartObjects: [],
    orders: [],
    trades: [],
    tradeSnapshots: [],
    tradeReplay: [],
    equityCurve: [],
    performanceSummary: {
      starting_equity: 0,
      ending_equity: 0,
      total_trades: 0,
      win_rate: 0,
      net_pnl: 0,
      max_drawdown: 0,
      setup_stats: []
    },
    journal: []
  };
}

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string") {
      return payload.detail;
    }
  } catch {
    // Keep the final error deterministic when the API returns a non-JSON body.
  }
  return `PAquant API returned ${response.status}`;
}
