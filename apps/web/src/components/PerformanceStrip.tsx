import { LineChart } from "lucide-react";
import type { EquityPoint, SimulatedTrade } from "../lib/workbenchTypes";

interface PerformanceStripProps {
  equityCurve: EquityPoint[];
  trade?: SimulatedTrade;
}

export function PerformanceStrip({ equityCurve, trade }: PerformanceStripProps) {
  const first = equityCurve[0]?.equity ?? 0;
  const last = equityCurve.at(-1)?.equity ?? first;
  const delta = last - first;
  const winRate = trade && trade.pnl > 0 ? 100 : 0;

  return (
    <section className="data-panel performance-panel">
      <div className="panel-heading">
        <LineChart size={16} />
        Performance
      </div>
      <div className="metric-grid">
        <div>
          <span>Equity</span>
          <strong>{last.toFixed(2)}</strong>
        </div>
        <div>
          <span>PnL</span>
          <strong className={delta >= 0 ? "positive" : "negative"}>{delta.toFixed(2)}</strong>
        </div>
        <div>
          <span>Win rate</span>
          <strong>{winRate}%</strong>
        </div>
      </div>
      <svg className="equity-spark" viewBox="0 0 100 34" aria-label="Equity curve">
        <polyline
          points={equityCurve
            .map((point, index) => {
              const x = equityCurve.length <= 1 ? 0 : (index / (equityCurve.length - 1)) * 100;
              const y = 30 - Math.max(point.equity - first, 0) * 1.8;
              return `${x},${Math.max(4, y)}`;
            })
            .join(" ")}
        />
      </svg>
    </section>
  );
}
