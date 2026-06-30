import { LineChart } from "lucide-react";
import { translateText } from "../lib/displayText";
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
        绩效
      </div>
      <div className="metric-grid">
        <div>
          <span>权益</span>
          <strong>{last.toFixed(2)}</strong>
        </div>
        <div>
          <span>盈亏</span>
          <strong className={summary.net_pnl >= 0 ? "positive" : "negative"}>
            {summary.net_pnl.toFixed(2)}
          </strong>
        </div>
        <div>
          <span>胜率</span>
          <strong>{winRate.toFixed(0)}%</strong>
        </div>
        <div>
          <span>最大回撤</span>
          <strong className={summary.max_drawdown < 0 ? "negative" : ""}>
            {summary.max_drawdown.toFixed(2)}
          </strong>
        </div>
        <div>
          <span>平均R</span>
          <strong>{primarySetup ? primarySetup.average_r.toFixed(2) : "0.00"}</strong>
        </div>
        <div>
          <span>交易数</span>
          <strong>{summary.total_trades}</strong>
        </div>
      </div>
      {primarySetup ? (
        <div className="setup-summary">
          <h2>形态统计</h2>
          <span>{translateText(primarySetup.setup_name)}</span>
          <strong>
            {primarySetup.trades} 笔 | {primarySetup.win_rate * 100}% 胜率 |{" "}
            {primarySetup.total_r.toFixed(1)}R
          </strong>
        </div>
      ) : null}
      <svg className="equity-spark" viewBox="0 0 100 34" aria-label="权益曲线">
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
