import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "./App";
import fixtureData from "./fixtures/paquant-demo.json";
import type { LiveMarketPayload, WorkbenchFixture } from "./lib/workbenchTypes";

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
    timestamp: fixture.candles.at(-1)?.timestamp ?? "2026-06-30T00:00:00Z",
    providerSymbol: "GC=F"
  },
  candles: fixture.candles
};

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

test("renders live market data first and runs the AI trader only after user starts it", async () => {
  render(<App />);

  expect(
    await screen.findByRole("heading", { name: /PAquant XAU workstation/i })
  ).toBeInTheDocument();
  expect(screen.getAllByText("Brooks Generalist").length).toBeGreaterThan(0);
  expect(screen.getByText("Live market API")).toBeInTheDocument();
  expect(screen.getByText(/GC=F futures proxy, not spot XAU/i)).toBeInTheDocument();
  expect(screen.getByText("AI trader roster")).toBeInTheDocument();
  expect(screen.getByText("Always-In Trend Trader")).toBeInTheDocument();
  expect(screen.getByText("Wedge/Reversal Specialist")).toBeInTheDocument();
  expect(screen.getByTestId("chart-host")).toBeInTheDocument();
  expect(screen.getByText("AI trader idle")).toBeInTheDocument();
  expect(screen.queryByText("Tool actions")).not.toBeInTheDocument();
  expect(screen.queryByText(/Simulated orders/i)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Model API")).toHaveValue("deepseek");
  expect(screen.getByText("Last price")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Start data stream/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Start AI trader/i })).toBeInTheDocument();
  expect(screen.getByText("Knowledge browser")).toBeInTheDocument();
  expect(screen.getByText("Case cards")).toBeInTheDocument();
  expect(screen.getByText("Reasoning playbooks")).toBeInTheDocument();
  expect(screen.getByText("Source mapping")).toBeInTheDocument();
  expect(screen.getByText("Bar 24/72")).toBeInTheDocument();
  expect(screen.queryByText(/mock-brooks/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Start data stream/i }));
  await waitFor(() => expect(screen.getByText("Bar 25/72")).toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: /Start AI trader/i }));

  expect(await screen.findByText("Tool actions")).toBeInTheDocument();
  expect(screen.getByText("draw_channel")).toBeInTheDocument();
  expect(screen.getByText("measure_deviation")).toBeInTheDocument();
  expect(screen.getByText(/Model API: deepseek \/ deepseek-chat/i)).toBeInTheDocument();
  expect(screen.getByText(/Position size 1/i)).toBeInTheDocument();
  expect(screen.getByText(/Trade reason/i)).toBeInTheDocument();
  expect(screen.getByText(/Entry 2310.00/i)).toBeInTheDocument();
  expect(screen.getByText(/Stop 2305.00/i)).toBeInTheDocument();
  expect(screen.getByText(/Target 2320.00/i)).toBeInTheDocument();
  expect(screen.getByText(/Simulated orders/i)).toBeInTheDocument();
  expect(screen.getByText("Trade replay")).toBeInTheDocument();
  expect(screen.getByText("Pre-entry")).toBeInTheDocument();
  expect(screen.getByText("Execution")).toBeInTheDocument();
  expect(screen.getByText("Post-trade review")).toBeInTheDocument();
  expect(screen.getByText("MFE")).toBeInTheDocument();
  expect(screen.getByText("MAE")).toBeInTheDocument();
  expect(screen.getByText("Max DD")).toBeInTheDocument();
  expect(screen.getByText("Setup stats")).toBeInTheDocument();
  expect(screen.getByText("Fill")).toBeInTheDocument();
  expect(screen.getByText("LIMIT")).toBeInTheDocument();
  expect(screen.getByText(/Snapshot 0-12/i)).toBeInTheDocument();
  expect(screen.getByText("Knowledge refs")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Reset replay/i }));
  expect(screen.getByText("Bar 9/72")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Next bar/i }));
  expect(screen.getByText("Bar 10/72")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Wedge\/Reversal Specialist/i }));

  expect(
    within(screen.getByLabelText("AI trader analysis")).getByText("Wedge/Reversal Specialist")
  ).toBeInTheDocument();
});

test("labels quote-only live data and surfaces the AI trader history guard", async () => {
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
        return {
          ok: false,
          json: async () => ({
            detail:
              "live AI trader requires full 5m candle history before thinking, drawing, or placing simulated orders"
          })
        };
      }
      throw new Error(`unexpected fetch ${url}`);
    })
  );

  render(<App />);

  expect(
    await screen.findByText(/Live XAU spot quote only; full 5m history unavailable/i)
  ).toBeInTheDocument();
  expect(screen.getByText("Gold API XAU/USD realtime spot quote")).toBeInTheDocument();
  expect(screen.getByText("1 quote")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Start AI trader/i }));

  expect(await screen.findByText(/requires full 5m candle history/i)).toBeInTheDocument();
  expect(screen.queryByText("LIMIT")).not.toBeInTheDocument();
});
