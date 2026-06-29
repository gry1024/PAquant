import { LineChart } from "lucide-react";
import type { EquityPoint, PerformanceSummary, SimulatedTrade } from "../lib/workbenchTypes";

interface PerformanceStripProps {
  equityCurve: EquityPoint[];
  summary: PerformanceSummary;
  trade?: SimulatedTrade;
}

export function PerformanceStrip({ equityCurve, summary, trade }: PerformanceStripProps) {
  const first = equityCurve[0]?.equity ?? 0;
  const last = equityCurve.at(-1)?.equity ?? first;
  const winRate = summary.win_rate * 100;
  const primarySetup = summary.setup_stats[0];

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
          <strong className={summary.net_pnl >= 0 ? "positive" : "negative"}>
            {summary.net_pnl.toFixed(2)}
          </strong>
        </div>
        <div>
          <span>Win rate</span>
          <strong>{winRate.toFixed(0)}%</strong>
        </div>
        <div>
          <span>Max DD</span>
          <strong className={summary.max_drawdown < 0 ? "negative" : ""}>
            {summary.max_drawdown.toFixed(2)}
          </strong>
        </div>
        <div>
          <span>Avg R</span>
          <strong>{primarySetup ? primarySetup.average_r.toFixed(2) : "0.00"}</strong>
        </div>
        <div>
          <span>Trades</span>
          <strong>{summary.total_trades}</strong>
        </div>
      </div>
      {primarySetup ? (
        <div className="setup-summary">
          <h2>Setup stats</h2>
          <span>{primarySetup.setup_name}</span>
          <strong>
            {primarySetup.trades} trade | {primarySetup.win_rate * 100}% WR |{" "}
            {primarySetup.total_r.toFixed(1)}R
          </strong>
        </div>
      ) : null}
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
      {trade ? (
        <div className="trade-excursion-summary">
          <span>MFE {trade.max_favorable_r.toFixed(2)}R</span>
          <span>MAE {trade.max_adverse_r.toFixed(2)}R</span>
        </div>
      ) : null}
    </section>
  );
}
