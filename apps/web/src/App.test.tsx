import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "./App";
import fixtureData from "./fixtures/paquant-demo.json";
import type { LiveMarketPayload, TraderProfile, WorkbenchFixture } from "./lib/workbenchTypes";

const fixture = fixtureData as WorkbenchFixture;
const livePayload: LiveMarketPayload = {
  source: {
    id: "yahoo_gc_futures_proxy",
    label: "Yahoo Finance GC=F COMEX gold futures proxy",
    instrumentSymbol: "GC=F",
    instrumentKind: "futures_proxy",
    isSpot: false,
    isMock: false,
    latency: "near_realtime"
  },
  quote: {
    symbol: "XAUUSD",
    price: fixture.candles.at(-1)?.close ?? 0,
    bid: 2338.1,
    ask: 2338.7,
    timestamp: fixture.candles.at(-1)?.timestamp ?? "2026-06-30T00:00:00Z",
    providerSymbol: "GC=F"
  },
  candles: fixture.candles
};

const traderIds = [
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
];

const apiTraderProfiles: TraderProfile[] = traderIds.map((id, index) => ({
  id,
  name: `Brooks strategy ${index + 1}`,
  persona: `Auditable Brooks setup trader ${id}`,
  status: index === 0 ? "active" : index < 6 ? "standby" : "research",
  symbol: "XAUUSD",
  timeframe: "5m",
  preferredSetups: [`setup-${index + 1}`, "signal bar", "risk equation"],
  riskStyle: "One unit risk after signal bar confirmation.",
  toolPermissions: ["draw_trendline", "draw_box", "measure_leg", "snap_to_swing"],
  knowledgePolicy: "Use Brooks setup dossiers before decisions.",
  agentFile: `.agents/traders/${id}.md`,
  sharedKnowledgeFiles: [
    ".agents/common/price-action-core.md",
    ".agents/common/risk-control.md"
  ],
  sharedKnowledgeSummary: "Shared Price Action Core / Shared Risk Control",
  recentAction: `Waiting for ${id} signal.`,
  performance: {
    equity: 10_000 + index * 10,
    winRate: index === 0 ? 1 : 0,
    maxDrawdown: index * 0.1,
    trades: index === 0 ? 1 : 0,
    averageR: index === 0 ? 2 : 0
  }
}));

async function flushMicrotasks(times = 8) {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function expectNoMojibake() {
  expect(document.body.textContent ?? "").not.toMatch(
    /榛勯噾|绛夊緟|妯″瀷|甯冮瞾|鐐瑰樊|瀹炴椂|浜ゆ槗|鍏ュ満|姝㈡崯|姝㈢泩|K绾|鍥炴斁|杩愯/
  );
}

async function waitForWorkbench() {
  return screen.findByLabelText("原生K线图表区");
}

const agentRunPayload: WorkbenchFixture = {
  ...fixture,
  meta: {
    source: "api",
    symbol: "XAUUSD",
    timeframe: "5m",
    traderId: "brooks-generalist",
    modelProvider: "deepseek",
    model: "deepseek-chat",
    startedBy: "user",
    agentStatus: "completed",
    dataSource: livePayload.source
  },
  analysis: {
    ...fixture.analysis,
    reasoningSummary: "DeepSeek produced a Brooks pullback thesis after tool calls.",
    modelUsage: {
      provider: "deepseek",
      model: "deepseek-chat",
      input_tokens: 120,
      output_tokens: 64,
      estimated_cost_usd: 0.000102
    }
  }
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/market/xau/live") {
        return {
          ok: true,
          json: async () => livePayload
        };
      }
      if (url === "/api/model-providers") {
        return {
          ok: true,
          json: async () => ({
            providers: [
              {
                id: "deepseek",
                name: "DeepSeek",
                model: "deepseek-chat",
                apiKeyEnv: "DEEPSEEK_API_KEY",
                available: true,
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
              }
            ]
          })
        };
      }
      if (url === "/api/traders") {
        return {
          ok: true,
          json: async () => ({ traders: apiTraderProfiles })
        };
      }
      if (url === "/api/agent-runs") {
        return {
          ok: true,
          json: async () => agentRunPayload
        };
      }
      throw new Error(`unexpected fetch ${url}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("渲染中文双栏交易终端，启动前不会展示 AI 订单或绘图结果", async () => {
  render(<App />);

  expect(await waitForWorkbench()).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /PAquant 黄金交易终端/i })).toBeInTheDocument();
  expect(screen.getByLabelText("AI 交易员执行区")).toBeInTheDocument();
  expect(screen.getByTestId("chart-host")).toBeInTheDocument();
  expect(screen.getByText("实时价格")).toBeInTheDocument();
  expect(screen.getByText("买价")).toBeInTheDocument();
  expect(screen.getByText("卖价")).toBeInTheDocument();
  expect(screen.getByText("点差")).toBeInTheDocument();
  expect(screen.getByText("2338.10")).toBeInTheDocument();
  expect(screen.getByText("2338.70")).toBeInTheDocument();
  expect(screen.getByText("0.60")).toBeInTheDocument();
  expect(screen.getAllByText("布鲁克斯通用交易员").length).toBeGreaterThan(0);
  expect(screen.getByLabelText("模型 API")).toHaveValue("deepseek");
  expect(screen.getByLabelText("AI 交易员")).toHaveValue("brooks-generalist");
  expect(screen.getAllByText("等待启动").length).toBeGreaterThan(0);
  expect(screen.queryByText(/模拟订单/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/工具执行/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Start AI trader|Simulated orders|Live market window|AI trader idle/)).not.toBeInTheDocument();
  expect(vi.mocked(fetch)).not.toHaveBeenCalledWith("/api/agent-runs", expect.anything());
  expectNoMojibake();

  fireEvent.click(screen.getByRole("button", { name: /放大 K 线/i }));
  expect(screen.getByText(/窗口 \d+ 根/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /向左滑动图表/i }));
  expect(screen.getByText(/窗口 \d+ 根/i)).toBeInTheDocument();
});

test("实时行情返回的 MT5 结构对象会直接附着在 K 线上", async () => {
  const lastIndex = fixture.candles.length - 1;
  const structureStart = Math.max(0, lastIndex - 18);
  const structureEnd = Math.max(structureStart, lastIndex - 4);
  const marketWithStructureObjects: LiveMarketPayload = {
    ...livePayload,
    source: {
      ...livePayload.source,
      id: "mt5_bridge_xauusd_5m",
      label: "MT5 / MetaTrader 5 XAUUSDc 5分钟",
      instrumentSymbol: "XAUUSDc",
      instrumentKind: "mt5_broker",
      isSpot: true,
      historyCompleteness: "historical_5m",
      latency: "broker_terminal"
    },
    chartObjects: [
      {
        kind: "range_box",
        id: "mt5-structure-range",
        label: "MT5 最近结构箱体",
        start_index: structureStart,
        end_index: structureEnd,
        high: Math.max(...fixture.candles.slice(structureStart, structureEnd + 1).map((candle) => candle.high)),
        low: Math.min(...fixture.candles.slice(structureStart, structureEnd + 1).map((candle) => candle.low)),
        reason: "MT5 实时行情识别的有限范围结构箱体。"
      },
      {
        kind: "trendline",
        id: "mt5-structure-trend",
        label: "MT5 最近趋势线",
        anchors: [
          { time_index: structureStart, price: fixture.candles[structureStart].low },
          { time_index: lastIndex, price: fixture.candles[lastIndex].close }
        ],
        reason: "MT5 实时行情识别的有限范围趋势线。"
      }
    ]
  };
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/market/xau/live") {
      return { ok: true, json: async () => marketWithStructureObjects } as Response;
    }
    if (url === "/api/model-providers") {
      return { ok: true, json: async () => ({ providers: [] }) } as Response;
    }
    if (url === "/api/traders") {
      return { ok: true, json: async () => ({ traders: [] }) } as Response;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  render(<App />);
  await waitForWorkbench();

  await waitFor(() =>
    expect(document.querySelector('[data-object-id="mt5-structure-range"]')).toBeInTheDocument()
  );
  await waitFor(() =>
    expect(document.querySelector('[data-object-id="mt5-structure-trend"]')).toBeInTheDocument()
  );
  expect(screen.queryByText(/模拟订单/i)).not.toBeInTheDocument();
});

test("用户启动后，AI 交易员会按模型调用、绘图工具、下单策略逐步输出", async () => {
  render(<App />);
  await waitForWorkbench();

  fireEvent.click(screen.getByRole("button", { name: /启动 AI 交易员/i }));

  await waitFor(() => expect(screen.getAllByText("调用模型 API").length).toBeGreaterThan(0));
  await waitFor(() =>
    expect(screen.getAllByText(/模型 API：deepseek \/ deepseek-chat/i).length).toBeGreaterThan(0)
  );
  expect(await screen.findByText("执行绘图工具")).toBeInTheDocument();
  expect(await screen.findByText("draw_channel", undefined, { timeout: 6_000 })).toBeInTheDocument();
  expect(await screen.findByText("measure_deviation", undefined, { timeout: 6_000 })).toBeInTheDocument();
  const analysisPanel = screen.getByLabelText("AI 交易员分析");
  const decisionPanel = within(analysisPanel).getByLabelText("交易员思考和决策");
  expect(within(decisionPanel).getByText("决策轨迹")).toBeInTheDocument();
  expect(within(decisionPanel).getAllByText(/订单类型|触发价|信号K线|风险回报/).length).toBeGreaterThan(0);
  expect(within(analysisPanel).getByText("结构化思考")).toBeInTheDocument();
  expect(within(analysisPanel).getByText("1 市场上下文")).toBeInTheDocument();
  expect(within(analysisPanel).getByText("2 始终在场方向")).toBeInTheDocument();
  expect(within(analysisPanel).getByText("3 结构状态")).toBeInTheDocument();
  expect(within(analysisPanel).getByText("4 关键价位")).toBeInTheDocument();
  expect(within(analysisPanel).getByText("5 交易假设")).toBeInTheDocument();
  expect(within(analysisPanel).getByText("6 失效与计划")).toBeInTheDocument();
  expect(within(analysisPanel).getByText(/趋势强度/i)).toBeInTheDocument();
  expect(within(analysisPanel).getAllByText(/交易区间/i).length).toBeGreaterThan(0);
  expect(within(analysisPanel).getByText(/失效条件/i)).toBeInTheDocument();
  expect((await screen.findAllByText(/交易理由/i, undefined, { timeout: 6_000 })).length).toBeGreaterThan(0);
  expect(await screen.findByText(/下单策略/i, undefined, { timeout: 6_000 })).toBeInTheDocument();
  expect(screen.getAllByText(/仓位 1/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/入场 2323.03/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/止损 2316.59/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/止盈 2335.91/i).length).toBeGreaterThan(0);
  expect(await screen.findByText(/模拟订单/i, undefined, { timeout: 6_000 })).toBeInTheDocument();
  const chartPanel = screen.getByLabelText("XAU 5分钟K线图");
  expect(within(chartPanel).getAllByText("入场 2323.03 仓位 1").length).toBeGreaterThan(0);
  expect(screen.getByText("交易复盘")).toBeInTheDocument();
  expect(screen.getByText("入场前")).toBeInTheDocument();
  expect(screen.getByText("执行")).toBeInTheDocument();
  expect(screen.getByText("交易后复盘")).toBeInTheDocument();
  expect(screen.getByText("MFE")).toBeInTheDocument();
  expect(screen.getByText("MAE")).toBeInTheDocument();
  expect(screen.getByText("最大回撤")).toBeInTheDocument();
  expect(screen.getByText("形态统计")).toBeInTheDocument();
  expect(screen.getByText("成交")).toBeInTheDocument();
  expect(screen.getByText("Stop 单")).toBeInTheDocument();
  expect(screen.getByText(/快照 0-12/i)).toBeInTheDocument();
  expect(screen.getByText("知识引用")).toBeInTheDocument();
  expectNoMojibake();

  fireEvent.change(screen.getByLabelText("AI 交易员"), { target: { value: "wedge-reversal" } });

  expect(within(screen.getByLabelText("AI 交易员分析")).getByText("楔形反转专家")).toBeInTheDocument();
}, 15_000);

test("实时行情首次请求很慢时，首屏不显示任何模拟或本地回放价格", async () => {
  const liveMarketDeferred = deferred<LiveMarketPayload>();
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/market/xau/live") {
      return {
        ok: true,
        json: async () => liveMarketDeferred.promise
      } as Response;
    }
    if (url === "/api/model-providers") {
      return {
        ok: true,
        json: async () => ({ providers: [] })
      } as Response;
    }
    if (url === "/api/traders") {
      return {
        ok: true,
        json: async () => ({ traders: [] })
      } as Response;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  render(<App />);

  expect(await screen.findByText("正在连接真实行情")).toBeInTheDocument();
  expect(screen.queryByLabelText("原生K线图表区")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("AI 交易员执行区")).not.toBeInTheDocument();
  expect(screen.queryByText(fixture.candles[0].open.toFixed(2))).not.toBeInTheDocument();
  expect(screen.queryByText(fixture.candles.at(-1)!.close.toFixed(2))).not.toBeInTheDocument();

  liveMarketDeferred.resolve(livePayload);
  await waitFor(() => expect(screen.getByText("2338.70")).toBeInTheDocument());
  expect(screen.getByRole("button", { name: /启动 AI 交易员/i })).toBeEnabled();
});

test("左侧导航提供主界面、AI交易员图谱和价格行为知识库三个产品视图", async () => {
  render(<App />);
  await waitForWorkbench();

  expect(screen.getByRole("button", { name: /1 主界面/i })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /2 AI交易员图谱/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /3 价格行为知识库/i })).toBeInTheDocument();
  expect(screen.queryByLabelText("绘图工具")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /2 AI交易员图谱/i }));
  expect(screen.getByLabelText("AI交易员图谱")).toBeInTheDocument();
  expect(screen.getByText("始终在场趋势交易员")).toBeInTheDocument();
  expect(screen.getByText(/收益曲线/i)).toBeInTheDocument();
  expect(screen.getByText(".agents/traders/always-in-trend.md")).toBeInTheDocument();
  expect(document.querySelectorAll(".trader-roster-card")).toHaveLength(apiTraderProfiles.length);
  expect(screen.getByText("10 位交易员")).toBeInTheDocument();
  expect(screen.getByText(".agents/traders/second-entry.md")).toBeInTheDocument();
  expect(screen.getByText(".agents/traders/final-flag.md")).toBeInTheDocument();
  expect(screen.getByText(".agents/common/price-action-core.md")).toBeInTheDocument();
  expect(screen.getByText(".agents/common/risk-control.md")).toBeInTheDocument();
  expect(screen.getByText(/Shared Price Action Core \/ Shared Risk Control/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /3 价格行为知识库/i }));
  expect(screen.getByLabelText("阿尔布鲁克斯价格行为学知识库")).toBeInTheDocument();
  expect(screen.getByText(/教材目录/i)).toBeInTheDocument();
  expect(screen.getByText(/术语表/i)).toBeInTheDocument();
  expect(screen.getByText(/Trading Price Action - Trends/i)).toBeInTheDocument();
});

test("AI 运行结果不会把当前实时K线替换回演示行情", async () => {
  const liveCandles = fixture.candles.map((candle, index) =>
    index === fixture.candles.length - 1
      ? {
          ...candle,
          open: 2598.6,
          high: 2601.4,
          low: 2597.8,
          close: 2600.12
        }
      : candle
  );
  const currentMarket: LiveMarketPayload = {
    ...livePayload,
    quote: { ...livePayload.quote, price: 2600.12, bid: 2599.8, ask: 2600.5 },
    candles: liveCandles
  };
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/market/xau/live") {
      return {
        ok: true,
        json: async () => currentMarket
      } as Response;
    }
    if (url === "/api/model-providers") {
      return {
        ok: true,
        json: async () => ({ providers: [] })
      } as Response;
    }
    if (url === "/api/traders") {
      return {
        ok: true,
        json: async () => ({ traders: [] })
      } as Response;
    }
    if (url === "/api/agent-runs") {
      return {
        ok: true,
        json: async () => agentRunPayload
      } as Response;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  render(<App />);

  const chartPanel = await screen.findByLabelText("XAU 5分钟K线图");
  await waitFor(() => expect(within(chartPanel).getAllByText("2600.12").length).toBeGreaterThan(0));
  const streamButton = document.querySelector(".stream-toggle") as HTMLButtonElement | null;
  expect(streamButton).not.toBeNull();
  fireEvent.click(streamButton!);
  await waitFor(() => expect(within(chartPanel).queryByText("2600.12")).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: /启动 AI 交易员/i }));
  expect(await screen.findByText(/模拟订单/i, undefined, { timeout: 6_000 })).toBeInTheDocument();

  await waitFor(() => expect(within(chartPanel).getAllByText("2600.12").length).toBeGreaterThan(0));
  expect(within(chartPanel).queryByText("2347.94")).not.toBeInTheDocument();
});

test("loaded long live history opens at the latest quoted candle", async () => {
  const longCandles = Array.from({ length: 240 }, (_, index) => {
    const open = 2500 + index * 0.4;
    const close = index === 239 ? 2600.12 : open + 0.18;
    const high = Math.max(open, close) + 0.45;
    const low = Math.min(open, close) - 0.45;
    return {
      timestamp: new Date(Date.UTC(2026, 5, 30, 0, index * 5)).toISOString(),
      symbol: "XAUUSD" as const,
      timeframe: "5m" as const,
      open,
      high,
      low,
      close,
      volume: 100 + index,
      body: Math.abs(close - open),
      range: high - low,
      close_position: (close - low) / (high - low)
    };
  });
  const currentMarket: LiveMarketPayload = {
    ...livePayload,
    source: {
      ...livePayload.source,
      historyCompleteness: "historical_5m"
    },
    quote: { ...livePayload.quote, price: 2600.12, bid: 2599.8, ask: 2600.5 },
    candles: longCandles
  };
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/market/xau/live") {
      return { ok: true, json: async () => currentMarket } as Response;
    }
    if (url === "/api/model-providers") {
      return { ok: true, json: async () => ({ providers: [] }) } as Response;
    }
    if (url === "/api/traders") {
      return { ok: true, json: async () => ({ traders: [] }) } as Response;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  render(<App />);

  await waitFor(() =>
    expect(document.querySelector(".replay-counter")?.textContent).toContain("240/240")
  );
  expect(document.querySelector(".chart-stats")?.textContent).toContain("2600.12");
  expect(screen.getAllByText("2600.12").length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole("button", { name: "最近48" }));
  expect(document.querySelector(".window-counter")?.textContent).toContain("48");
  expect(document.querySelector(".replay-counter")?.textContent).toContain("240/240");

  fireEvent.click(screen.getByRole("button", { name: "全部" }));
  expect(document.querySelector(".window-counter")?.textContent).toContain("240");

  fireEvent.click(screen.getByRole("button", { name: "最新" }));
  expect(document.querySelector(".replay-counter")?.textContent).toContain("240/240");

  fireEvent.change(screen.getByLabelText("图表视窗滑杆"), { target: { value: "120" } });
  expect(document.querySelector(".replay-counter")?.textContent).toContain("240/240");
  expect(document.querySelector(".window-counter")?.textContent).toContain("72");
  expect(document.querySelector(".chart-stats")?.textContent).toContain("2519.20");
});

test("长历史启动 AI 后，图表自动聚焦到交易标注窗口", async () => {
  const longCandles = Array.from({ length: 160 }, (_, index) => {
    const fixtureCandle = fixture.candles[index % fixture.candles.length];
    const drift = index * 0.52;
    const open = fixtureCandle.open + drift;
    const close = index === 159 ? 2600.12 : fixtureCandle.close + drift;
    const high = Math.max(open, close, fixtureCandle.high + drift);
    const low = Math.min(open, close, fixtureCandle.low + drift);
    return {
      ...fixtureCandle,
      timestamp: new Date(Date.UTC(2026, 5, 30, 0, index * 5)).toISOString(),
      open,
      high,
      low,
      close,
      body: Math.abs(close - open),
      range: high - low,
      close_position: (close - low) / Math.max(high - low, 1)
    };
  });
  const currentMarket: LiveMarketPayload = {
    ...livePayload,
    quote: { ...livePayload.quote, price: 2600.12, bid: 2599.8, ask: 2600.5 },
    candles: longCandles
  };
  const agentRunWithoutTradeMarkers: WorkbenchFixture = {
    ...agentRunPayload,
    chartObjects: agentRunPayload.chartObjects.filter((object) => object.kind !== "trade_marker")
  };
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/market/xau/live") {
      return { ok: true, json: async () => currentMarket } as Response;
    }
    if (url === "/api/model-providers") {
      return { ok: true, json: async () => ({ providers: [] }) } as Response;
    }
    if (url === "/api/traders") {
      return { ok: true, json: async () => ({ traders: [] }) } as Response;
    }
    if (url === "/api/agent-runs") {
      return { ok: true, json: async () => agentRunWithoutTradeMarkers } as Response;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  render(<App />);
  const chartPanel = await screen.findByLabelText("XAU 5分钟K线图");
  await waitFor(() => expect(within(chartPanel).getAllByText("2600.12").length).toBeGreaterThan(0));
  expect(within(chartPanel).queryByText("入场 2323.03 仓位 1")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /启动 AI 交易员/i }));
  expect(await screen.findByText(/模拟订单/i, undefined, { timeout: 6_000 })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("已完成")).toBeInTheDocument());

  expect(within(chartPanel).getAllByText("入场 2323.03 仓位 1").length).toBeGreaterThan(0);
  expect(document.querySelector(".replay-counter")?.textContent).toContain("/160");
}, 10_000);

test("AI run with wide model drawings still focuses the visible chart on trade markers", async () => {
  const longCandles = Array.from({ length: 160 }, (_, index) => {
    const fixtureCandle = fixture.candles[index % fixture.candles.length];
    const drift = index * 0.52;
    const open = fixtureCandle.open + drift;
    const close = index === 159 ? 2600.12 : fixtureCandle.close + drift;
    const high = Math.max(open, close, fixtureCandle.high + drift);
    const low = Math.min(open, close, fixtureCandle.low + drift);
    return {
      ...fixtureCandle,
      timestamp: new Date(Date.UTC(2026, 5, 30, 0, index * 5)).toISOString(),
      open,
      high,
      low,
      close,
      body: Math.abs(close - open),
      range: high - low,
      close_position: (close - low) / Math.max(high - low, 1)
    };
  });
  const currentMarket: LiveMarketPayload = {
    ...livePayload,
    quote: { ...livePayload.quote, price: 2600.12, bid: 2599.8, ask: 2600.5 },
    candles: longCandles
  };
  const agentRunWithWideModelLine: WorkbenchFixture = {
    ...agentRunPayload,
    chartObjects: [
      ...agentRunPayload.chartObjects,
      {
        kind: "trendline",
        id: "wide-model-context-line",
        label: "Wide model context line",
        anchors: [
          { time_index: 0, price: longCandles[0].low },
          { time_index: 159, price: longCandles[159].high }
        ]
      }
    ]
  };
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/market/xau/live") {
      return { ok: true, json: async () => currentMarket } as Response;
    }
    if (url === "/api/model-providers") {
      return { ok: true, json: async () => ({ providers: [] }) } as Response;
    }
    if (url === "/api/traders") {
      return { ok: true, json: async () => ({ traders: [] }) } as Response;
    }
    if (url === "/api/agent-runs") {
      return { ok: true, json: async () => agentRunWithWideModelLine } as Response;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  render(<App />);
  const chartPanel = await waitFor(() => {
    const element = document.querySelector(".chart-panel");
    expect(element).not.toBeNull();
    return element as HTMLElement;
  });

  fireEvent.click(document.querySelector(".agent-run-button") as HTMLButtonElement);
  await waitFor(() => expect(document.querySelector(".table-like")).toBeInTheDocument(), {
    timeout: 6_000
  });

  expect(document.querySelector(".trade-marker.entry")).toBeInTheDocument();
  expect(within(chartPanel).getAllByText(/2323\.03/).length).toBeGreaterThan(0);
  expect(document.querySelector(".chart-viewport-scrubber strong")?.textContent).toContain("1-72");
}, 10_000);

test("AI 交易员返回后不会一次性展示全部工具和订单，而是按执行节奏逐步露出", async () => {
  render(<App />);
  await waitForWorkbench();
  vi.useFakeTimers();

  fireEvent.click(screen.getByRole("button", { name: /启动 AI 交易员/i }));

  await act(async () => {
    await flushMicrotasks(20);
  });

  expect(screen.getAllByText(/模型 API：deepseek \/ deepseek-chat/i).length).toBeGreaterThan(0);
  expect(screen.queryByText("draw_channel")).not.toBeInTheDocument();
  expect(screen.queryByText(/模拟订单/i)).not.toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(420);
    await flushMicrotasks(6);
  });

  expect(screen.getByText("find_swings")).toBeInTheDocument();
  expect(screen.queryByText(/模拟订单/i)).not.toBeInTheDocument();

  for (let index = 0; index < 3; index += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(340);
      await flushMicrotasks(6);
    });
  }

  expect(screen.getByText("draw_channel")).toBeInTheDocument();
  expect(screen.queryByText(/模拟订单/i)).not.toBeInTheDocument();

  for (let index = 0; index < 7; index += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(340);
      await flushMicrotasks(6);
    });
  }
  await act(async () => {
    await vi.advanceTimersByTimeAsync(700);
    await flushMicrotasks(6);
  });

  expect(screen.getByText(/模拟订单/i)).toBeInTheDocument();
  expect(screen.getAllByText(/入场 2323.03/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/止损 2316.59/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/止盈 2335.91/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/仓位 1/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/交易理由/i).length).toBeGreaterThan(0);
});

test("实时行情轮询会刷新价格、买卖价和点差", async () => {
  const firstQuote = {
    ...livePayload,
    quote: { ...livePayload.quote, price: 2338.2, bid: 2338.1, ask: 2338.7 }
  };
  const secondQuote = {
    ...livePayload,
    quote: { ...livePayload.quote, price: 2339.4, bid: 2339.2, ask: 2339.9 }
  };
  let marketCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/market/xau/live") {
        marketCalls += 1;
        return {
          ok: true,
          json: async () => (marketCalls === 1 ? firstQuote : secondQuote)
        };
      }
      if (url === "/api/model-providers") {
        return {
          ok: true,
          json: async () => ({
            providers: [
              {
                id: "deepseek",
                name: "DeepSeek",
                model: "deepseek-chat",
                apiKeyEnv: "DEEPSEEK_API_KEY",
                available: true,
                capabilities: {
                  text: true,
                  vision: false,
                  structured_output: true,
                  tool_calling: true,
                  context_window: 64000
                }
              }
            ]
          })
        };
      }
      throw new Error(`unexpected fetch ${url}`);
    })
  );

  render(<App />);

  await act(async () => {
    await flushMicrotasks();
  });

  const chartPanel = await screen.findByLabelText("XAU 5分钟K线图");
  expect(screen.getAllByText("2338.20").length).toBeGreaterThan(0);
  expect(within(chartPanel).getAllByText("2338.20").length).toBeGreaterThan(0);

  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 2_100));
  });

  expect(screen.getAllByText("2339.40").length).toBeGreaterThan(0);
  expect(within(chartPanel).getAllByText("2339.40").length).toBeGreaterThan(0);
  expect(screen.getByText("2339.20")).toBeInTheDocument();
  expect(screen.getByText("2339.90")).toBeInTheDocument();
  expect(screen.getByText("0.70")).toBeInTheDocument();
  expect(screen.getByLabelText("价格跳动方向")).toHaveTextContent("↑ +1.20");
  expect(document.querySelector(".quote-primary")).toHaveClass("quote-up");
  expectNoMojibake();
}, 10_000);

test("仅有实时报价时，页面中文提示 AI 需要完整 5 分钟 K 线", async () => {
  const quoteOnlyPayload: LiveMarketPayload = {
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
      price: 3970.4,
      timestamp: "2026-06-30T03:23:49Z",
      providerSymbol: "XAU"
    },
    candles: [
      {
        timestamp: "2026-06-30T03:23:49Z",
        symbol: "XAUUSD",
        timeframe: "quote",
        open: 3970.4,
        high: 3970.4,
        low: 3970.4,
        close: 3970.4,
        volume: 0,
        body: 0,
        range: 0,
        close_position: 0.5
      }
    ]
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/market/xau/live") {
        return { ok: true, json: async () => quoteOnlyPayload };
      }
      if (url === "/api/model-providers") {
        return {
          ok: true,
          json: async () => ({
            providers: [
              {
                id: "deepseek",
                name: "DeepSeek",
                model: "deepseek-chat",
                apiKeyEnv: "DEEPSEEK_API_KEY",
                available: true,
                capabilities: {
                  text: true,
                  vision: false,
                  structured_output: true,
                  tool_calling: true,
                  context_window: 64000
                }
              }
            ]
          })
        };
      }
      if (url === "/api/agent-runs") {
        throw new Error("agent run should not start without full 5m candles");
      }
      throw new Error(`unexpected fetch ${url}`);
    })
  );

  render(<App />);

  expect(await screen.findByText(/仅实时 XAU 现货报价，暂缺完整 5 分钟历史 K 线/i)).toBeInTheDocument();
  expect(screen.getByText("Gold API XAU/USD 实时报价")).toBeInTheDocument();
  expect(screen.getByText("1 条报价")).toBeInTheDocument();
  expect(screen.getByText("3970.05")).toBeInTheDocument();
  expect(screen.getByText("3970.75")).toBeInTheDocument();
  expect(screen.getByText("0.70")).toBeInTheDocument();

  expect(screen.getByRole("button", { name: /等待实时行情/i })).toBeDisabled();
  expect(screen.getByText(/AI 交易员需要完整 5 分钟 K 线历史/i)).toBeInTheDocument();
  expect(screen.queryByText("限价")).not.toBeInTheDocument();
  expectNoMojibake();
});
