import {
  Activity,
  Bot,
  Box,
  Crosshair,
  GitCompareArrows,
  Layers3,
  MousePointer2,
  Play,
  Ruler,
  Square,
  TrendingUp
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChartPanel } from "./ChartPanel";
import { JournalPanel } from "./JournalPanel";
import { KnowledgeBrowserPanel } from "./KnowledgeBrowserPanel";
import { OrdersPanel } from "./OrdersPanel";
import { PerformanceStrip } from "./PerformanceStrip";
import { TradeReplayPanel } from "./TradeReplayPanel";
import { TraderPanel } from "./TraderPanel";
import { TraderRosterPanel } from "./TraderRosterPanel";
import type { ModelProviderChoice, TraderProfile, WorkbenchFixture } from "../lib/workbenchTypes";

const tools = [
  { label: "Pointer", icon: MousePointer2 },
  { label: "Crosshair", icon: Crosshair },
  { label: "Trend line", icon: TrendingUp },
  { label: "Range box", icon: Box },
  { label: "Measure", icon: Ruler },
  { label: "Compare legs", icon: GitCompareArrows },
  { label: "Layers", icon: Layers3 }
];

interface WorkbenchProps {
  fixture: WorkbenchFixture;
  traderProfiles: TraderProfile[];
  modelProviders: ModelProviderChoice[];
  onStartAgentRun: (traderId: string, modelProvider: string) => Promise<WorkbenchFixture>;
  sourceLabel?: string;
}

export function Workbench({
  fixture,
  traderProfiles,
  modelProviders,
  onStartAgentRun,
  sourceLabel
}: WorkbenchProps) {
  const [activeTraderId, setActiveTraderId] = useState(
    fixture.meta?.traderId ?? traderProfiles[0]?.id ?? "brooks-generalist"
  );
  const [selectedProviderId, setSelectedProviderId] = useState(
    modelProviders.find((provider) => provider.available)?.id ?? modelProviders[0]?.id ?? "deepseek"
  );
  const [agentFixture, setAgentFixture] = useState<WorkbenchFixture | null>(null);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [runError, setRunError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [visibleCandleCount, setVisibleCandleCount] = useState(
    Math.min(24, fixture.candles.length)
  );
  const activeTrader = useMemo(
    () => traderProfiles.find((profile) => profile.id === activeTraderId) ?? traderProfiles[0],
    [activeTraderId, traderProfiles]
  );
  const selectedProvider = useMemo(
    () => modelProviders.find((provider) => provider.id === selectedProviderId) ?? modelProviders[0],
    [modelProviders, selectedProviderId]
  );
  const visibleFixture = agentFixture ?? idleWorkbenchFixture(fixture);
  const totalCandleCount = fixture.candles.length;
  const boundedVisibleCandleCount = Math.min(
    Math.max(visibleCandleCount, 1),
    totalCandleCount
  );
  const firstReplayCount = ((agentFixture ?? fixture).tradeReplay[0]?.barIndex ?? 8) + 1;
  const latest = fixture.candles[boundedVisibleCandleCount - 1] ?? fixture.candles.at(-1);
  const trade = visibleFixture.trades.at(0);
  const activeTraderName = activeTrader?.name ?? "Brooks Generalist";
  const modelLabel = selectedProvider
    ? `${selectedProvider.name} / ${selectedProvider.model}`
    : "No model API configured";
  const dataSource = fixture.meta?.dataSource;
  const marketModeLabel =
    dataSource?.instrumentKind === "futures_proxy"
      ? "5m live feed: GC=F futures proxy, not spot XAU"
      : "5m live feed";

  useEffect(() => {
    if (!isStreaming) {
      return;
    }
    const timer = window.setInterval(() => {
      setVisibleCandleCount((count) => {
        const next = Math.min(totalCandleCount, count + 1);
        if (next >= totalCandleCount) {
          window.clearInterval(timer);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isStreaming, totalCandleCount]);

  async function handleStartAgentRun() {
    setRunStatus("running");
    setRunError(null);
    try {
      const run = await onStartAgentRun(activeTraderId, selectedProviderId);
      setAgentFixture(run);
      setRunStatus("completed");
    } catch (error) {
      setRunStatus("failed");
      setRunError(error instanceof Error ? error.message : "AI trader run failed");
    }
  }

  function handleToggleStream() {
    if (!isStreaming) {
      setVisibleCandleCount((count) => Math.min(totalCandleCount, count + 1));
    }
    setIsStreaming((current) => !current);
  }

  return (
    <main className="workbench-shell">
      <aside className="tool-rail" aria-label="Drawing tools">
        <div className="rail-mark">PA</div>
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button key={tool.label} className="icon-button" title={tool.label} aria-label={tool.label}>
              <Icon size={18} strokeWidth={1.9} />
            </button>
          );
        })}
      </aside>

      <section className="workspace">
        <header className="top-bar">
          <div>
            <h1>PAquant XAU workstation</h1>
            <div className="market-line">
              <span>XAUUSD</span>
              <span>{marketModeLabel}</span>
              <span>CloudBase target: paquant</span>
            </div>
          </div>
          <div className="status-strip" aria-label="Market status">
            <span>
              <Activity size={15} /> {activeTraderName}
            </span>
            {sourceLabel ? <span className="source-pill">{sourceLabel}</span> : null}
            {dataSource ? (
              <span className="source-pill" title={dataSource.label}>
                {dataSource.isMock ? "mock data" : dataSource.label}
              </span>
            ) : null}
            <span>
              <strong>Last</strong> {latest?.close.toFixed(2)}
            </span>
            <span>{fixture.candles.length} bars</span>
            {fixture.higherTimeframeContext.map((context) => (
              <span className="timeframe-chip" title={context.summary} key={context.timeframe}>
                {formatTimeframe(context.timeframe)} {context.bias}
              </span>
            ))}
          </div>
        </header>

        <section className="agent-control-strip" aria-label="AI trader controls">
          <label className="model-select">
            <span>Model API</span>
            <select
              aria-label="Model API"
              value={selectedProviderId}
              onChange={(event) => setSelectedProviderId(event.target.value)}
              disabled={runStatus === "running"}
            >
              {modelProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} / {provider.model}
                  {provider.available ? "" : " (no key)"}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="agent-run-button"
            onClick={handleStartAgentRun}
            disabled={runStatus === "running"}
          >
            <Bot size={15} />
            {runStatus === "running" ? "Running AI trader" : "Start AI trader"}
          </button>
          <span className={`agent-run-state ${runStatus}`}>
            {runStatus === "idle" ? "idle" : runStatus}
          </span>
          <span className="model-api-readout">{modelLabel}</span>
          {runError ? <span className="agent-run-error">{runError}</span> : null}
        </section>

        <TraderRosterPanel
          profiles={traderProfiles}
          activeTraderId={activeTraderId}
          onSelect={setActiveTraderId}
        />

        <div className="main-grid">
          <ChartPanel
            fixture={visibleFixture}
            visibleCandleCount={boundedVisibleCandleCount}
            isStreaming={isStreaming}
            onToggleStream={handleToggleStream}
            onResetReplay={() => setVisibleCandleCount(firstReplayCount)}
            onStepBack={() => setVisibleCandleCount((count) => Math.max(1, count - 1))}
            onStepForward={() =>
              setVisibleCandleCount((count) => Math.min(totalCandleCount, count + 1))
            }
            onShowAll={() => setVisibleCandleCount(totalCandleCount)}
          />
          <TraderPanel
            analysis={agentFixture?.analysis ?? null}
            actions={agentFixture?.agentActions ?? []}
            traderName={activeTraderName}
            modelLabel={
              agentFixture
                ? `${agentFixture.analysis.modelUsage.provider} / ${agentFixture.analysis.modelUsage.model}`
                : modelLabel
            }
            tradeReason={agentFixture?.orders[0]?.reason}
          />
        </div>

        <section className="bottom-grid" aria-label="Simulation and replay audit">
          {agentFixture ? (
            <>
              <OrdersPanel orders={agentFixture.orders} trades={agentFixture.trades} />
              <JournalPanel entries={agentFixture.journal} />
              <TradeReplayPanel
                steps={agentFixture.tradeReplay}
                snapshots={agentFixture.tradeSnapshots}
              />
              <PerformanceStrip
                equityCurve={agentFixture.equityCurve}
                summary={agentFixture.performanceSummary}
                trade={trade}
              />
            </>
          ) : (
            <section className="data-panel idle-panel">
              <div className="panel-heading">
                {isStreaming ? <Square size={16} /> : <Play size={16} />}
                Awaiting AI start
              </div>
              <p>
                Market data is visible. Start the AI trader to run model reasoning,
                execute tool calls, draw on the chart, and submit replay orders.
              </p>
            </section>
          )}
          <KnowledgeBrowserPanel knowledge={fixture.knowledge} />
        </section>
      </section>
    </main>
  );
}

function formatTimeframe(timeframe: "15m" | "1h") {
  return timeframe === "15m" ? "M15" : "H1";
}

function idleWorkbenchFixture(fixture: WorkbenchFixture): WorkbenchFixture {
  return {
    ...fixture,
    agentActions: [],
    chartObjects: [],
    orders: [],
    trades: [],
    tradeSnapshots: [],
    tradeReplay: [],
    equityCurve: [],
    journal: []
  };
}
