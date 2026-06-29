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
import { ChartPanel } from "./ChartPanel";
import { JournalPanel } from "./JournalPanel";
import { KnowledgeBrowserPanel } from "./KnowledgeBrowserPanel";
import { OrdersPanel } from "./OrdersPanel";
import { PerformanceStrip } from "./PerformanceStrip";
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
  const latest = fixture.candles.at(-1);
  const trade = fixture.trades.at(0);

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
              <Activity size={15} /> Brooks Generalist
            </span>
            {sourceLabel ? <span className="source-pill">{sourceLabel}</span> : null}
            <span>Last {latest?.close.toFixed(2)}</span>
            <span>{fixture.candles.length} bars</span>
          </div>
        </header>

        <TraderRosterPanel
          profiles={traderProfiles}
          activeTraderId={fixture.analysis.traderId}
        />

        <div className="main-grid">
          <ChartPanel fixture={fixture} />
          <TraderPanel analysis={fixture.analysis} />
        </div>

        <section className="bottom-grid" aria-label="Simulation and replay audit">
          <OrdersPanel orders={fixture.orders} trades={fixture.trades} />
          <JournalPanel entries={fixture.journal} />
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
