import {
  Activity,
  Box,
  Crosshair,
  GitCompareArrows,
  Layers3,
  MousePointer2,
  Ruler,
  TrendingUp
} from "lucide-react";
import { useMemo, useState } from "react";
import { ChartPanel } from "./ChartPanel";
import { JournalPanel } from "./JournalPanel";
import { KnowledgeBrowserPanel } from "./KnowledgeBrowserPanel";
import { OrdersPanel } from "./OrdersPanel";
import { PerformanceStrip } from "./PerformanceStrip";
import { TradeReplayPanel } from "./TradeReplayPanel";
import { TraderPanel } from "./TraderPanel";
import { TraderRosterPanel } from "./TraderRosterPanel";
import type { TraderProfile, WorkbenchFixture } from "../lib/workbenchTypes";

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
  sourceLabel?: string;
}

export function Workbench({ fixture, traderProfiles, sourceLabel }: WorkbenchProps) {
  const [activeTraderId, setActiveTraderId] = useState(fixture.analysis.traderId);
  const [visibleCandleCount, setVisibleCandleCount] = useState(fixture.candles.length);
  const activeTrader = useMemo(
    () => traderProfiles.find((profile) => profile.id === activeTraderId) ?? traderProfiles[0],
    [activeTraderId, traderProfiles]
  );
  const totalCandleCount = fixture.candles.length;
  const boundedVisibleCandleCount = Math.min(
    Math.max(visibleCandleCount, 1),
    totalCandleCount
  );
  const firstReplayCount = (fixture.tradeReplay[0]?.barIndex ?? 0) + 1;
  const latest = fixture.candles[boundedVisibleCandleCount - 1] ?? fixture.candles.at(-1);
  const trade = fixture.trades.at(0);
  const activeTraderName = activeTrader?.name ?? "Brooks Generalist";

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
              <span>5m replay</span>
              <span>CloudBase target: paquant</span>
            </div>
          </div>
          <div className="status-strip" aria-label="Market status">
            <span>
              <Activity size={15} /> {activeTraderName}
            </span>
            {sourceLabel ? <span className="source-pill">{sourceLabel}</span> : null}
            <span>Last {latest?.close.toFixed(2)}</span>
            <span>{fixture.candles.length} bars</span>
            {fixture.higherTimeframeContext.map((context) => (
              <span className="timeframe-chip" title={context.summary} key={context.timeframe}>
                {formatTimeframe(context.timeframe)} {context.bias}
              </span>
            ))}
          </div>
        </header>

        <TraderRosterPanel
          profiles={traderProfiles}
          activeTraderId={activeTraderId}
          onSelect={setActiveTraderId}
        />

        <div className="main-grid">
          <ChartPanel
            fixture={fixture}
            visibleCandleCount={boundedVisibleCandleCount}
            onResetReplay={() => setVisibleCandleCount(firstReplayCount)}
            onStepBack={() => setVisibleCandleCount((count) => Math.max(1, count - 1))}
            onStepForward={() =>
              setVisibleCandleCount((count) => Math.min(totalCandleCount, count + 1))
            }
            onShowAll={() => setVisibleCandleCount(totalCandleCount)}
          />
          <TraderPanel
            analysis={fixture.analysis}
            actions={fixture.agentActions}
            traderName={activeTraderName}
          />
        </div>

        <section className="bottom-grid" aria-label="Simulation and replay audit">
          <OrdersPanel orders={fixture.orders} trades={fixture.trades} />
          <JournalPanel entries={fixture.journal} />
          <TradeReplayPanel steps={fixture.tradeReplay} snapshots={fixture.tradeSnapshots} />
          <PerformanceStrip
            equityCurve={fixture.equityCurve}
            summary={fixture.performanceSummary}
            trade={trade}
          />
          <KnowledgeBrowserPanel knowledge={fixture.knowledge} />
        </section>
      </section>
    </main>
  );
}

function formatTimeframe(timeframe: "15m" | "1h") {
  return timeframe === "15m" ? "M15" : "H1";
}
