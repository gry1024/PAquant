import fixtureData from "../fixtures/paquant-demo.json";
import type {
  Candle,
  LiveMarketPayload,
  LiveMarketQuote,
  LiveMarketSource,
  ModelProviderChoice,
  WorkbenchFixture,
  WorkbenchMeta
} from "./workbenchTypes";

const CLOUDBASE_HTTP_API_BASE_URL =
  "https://groy-env-d5g7okht7dcd202fe-1401196005.ap-shanghai.app.tcloudbase.com/api";
const API_LIVE_MARKET_PATH = "/market/xau/live";
const API_MODEL_PROVIDERS_PATH = "/model-providers";
const API_AGENT_RUNS_PATH = "/agent-runs";
const FOREXSB_XAUUSD_M5_URL =
  "https://data.forexsb.com/datafeed/data/dukascopy/XAUUSD5.lb.gz";
const FOREXSB_MAX_VISIBLE_CANDLES = 240;
const FOREXSB_BROWSER_TIMEOUT_MS = 20_000;
const FOREXSB_MILLENNIUM = Date.UTC(2000, 0, 1);
const FOREXSB_XAU_PRICE_SCALE = 1000;
const FOREXSB_XAU_VOLUME_SCALE = 1;
const fixture = fixtureData as WorkbenchFixture;
export const fallbackModelProviders: ModelProviderChoice[] = [
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
  const liveMarket = await loadLiveMarketPayload(fetcher);
  if (hasUsableLiveCandles(liveMarket)) {
    return workbenchFromLiveMarket(liveMarket);
  }
  const candles = await loadForexsbXauUsd5mCandles(fetcher).catch(() => null);
  if (candles && candles.length >= 20) {
    return workbenchFromLiveMarket({
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
      quote: liveMarket.quote,
      candles
    });
  }
  return workbenchFromLiveMarket(liveMarket);
}

export function loadInitialWorkbenchFixture(): WorkbenchFixture {
  return {
    ...fixture,
    meta: {
      source: "fixture",
      symbol: "XAUUSD",
      timeframe: "5m",
      traderId: "brooks-generalist",
      agentStatus: "idle"
    },
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

export async function loadLiveMarketPayload(
  fetcher: typeof fetch = globalThis.fetch
): Promise<LiveMarketPayload> {
  const response = await fetcher(resolveApiUrl(API_LIVE_MARKET_PATH));
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as LiveMarketPayload;
}

export async function loadModelProviders(
  fetcher: typeof fetch = globalThis.fetch
): Promise<ModelProviderChoice[]> {
  try {
    const response = await fetcher(resolveApiUrl(API_MODEL_PROVIDERS_PATH));
    if (!response.ok) {
      throw new Error(`PAquant API returned ${response.status}`);
    }
    const payload = (await response.json()) as { providers: ModelProviderChoice[] };
    if (!payload.providers?.length) {
      throw new Error("PAquant API returned no model providers");
    }
    return payload.providers;
  } catch {
    return fallbackModelProviders;
  }
}

export async function startAgentRun(
  {
    traderId,
    modelProvider,
    market
  }: {
    traderId: string;
    modelProvider: string;
    market?: {
      source?: LiveMarketSource;
      quote?: LiveMarketQuote;
      candles?: Candle[];
    };
  },
  fetcher: typeof fetch = globalThis.fetch
): Promise<WorkbenchFixture> {
  const response = await fetcher(resolveApiUrl(API_AGENT_RUNS_PATH), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ traderId, modelProvider, market })
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as WorkbenchFixture;
}

export async function loadForexsbXauUsd5mCandles(
  fetcher: typeof fetch = globalThis.fetch,
  maxCandles = FOREXSB_MAX_VISIBLE_CANDLES,
  timeoutMs = FOREXSB_BROWSER_TIMEOUT_MS
): Promise<Candle[]> {
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  const timeout =
    controller == null
      ? null
      : globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(FOREXSB_XAUUSD_M5_URL, {
      headers: { Accept: "application/octet-stream" },
      signal: controller?.signal
    });
    if (!response.ok) {
      throw new Error(`ForexSB XAUUSD M5 returned ${response.status}`);
    }
    return parseForexsbXauUsd5m(await response.arrayBuffer(), maxCandles);
  } finally {
    if (timeout != null) {
      globalThis.clearTimeout(timeout);
    }
  }
}

export function parseForexsbXauUsd5m(buffer: ArrayBuffer, maxCandles: number): Candle[] {
  const view = new DataView(buffer);
  if (view.byteLength < 24) {
    throw new Error("ForexSB XAUUSD M5 payload is empty");
  }
  if (view.getUint8(0) === 0x1f && view.getUint8(1) === 0x8b) {
    throw new Error("ForexSB XAUUSD M5 payload was not decompressed by fetch");
  }
  const recordSize = view.byteLength % 28 === 0 ? 28 : 24;
  const totalBars = Math.floor(view.byteLength / recordSize);
  const startBar = Math.max(0, totalBars - maxCandles);
  const candles: Candle[] = [];
  for (let bar = startBar; bar < totalBars; bar += 1) {
    const offset = bar * recordSize;
    const timestamp = new Date(
      FOREXSB_MILLENNIUM + view.getInt32(offset, true) * 60_000
    ).toISOString();
    const open = view.getInt32(offset + 4, true) / FOREXSB_XAU_PRICE_SCALE;
    const high = view.getInt32(offset + 8, true) / FOREXSB_XAU_PRICE_SCALE;
    const low = view.getInt32(offset + 12, true) / FOREXSB_XAU_PRICE_SCALE;
    const close = view.getInt32(offset + 16, true) / FOREXSB_XAU_PRICE_SCALE;
    const volume = Math.ceil(
      (view.getInt32(offset + 20, true) || 1) / FOREXSB_XAU_VOLUME_SCALE
    );
    const range = high - low;
    candles.push({
      timestamp,
      symbol: "XAUUSD",
      timeframe: "5m",
      open,
      high,
      low,
      close,
      volume,
      body: Math.abs(close - open),
      range,
      close_position: range === 0 ? 0.5 : (close - low) / range
    });
  }
  return candles;
}

export function resolveApiUrl(path: string, currentHref = globalThis.location?.href): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (isCloudBaseStaticHost(currentHref)) {
    return `${CLOUDBASE_HTTP_API_BASE_URL}${normalizedPath}`;
  }
  return `/api${normalizedPath}`;
}

function isCloudBaseStaticHost(currentHref?: string): boolean {
  if (!currentHref) {
    return false;
  }
  try {
    const { hostname } = new URL(currentHref);
    return hostname.endsWith(".webapps.tcloudbase.com") || hostname.endsWith(".tcloudbaseapp.com");
  } catch {
    return false;
  }
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

function hasUsableLiveCandles(payload: LiveMarketPayload): boolean {
  return (
    payload.source.historyCompleteness !== "latest_quote_only" &&
    payload.candles.length >= 20 &&
    payload.candles.every((candle) => candle.timeframe === "5m")
  );
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
