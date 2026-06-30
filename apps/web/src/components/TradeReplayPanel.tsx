import { History } from "lucide-react";
import { formatReplayStage, translateText } from "../lib/displayText";
import type { TradeReplayStep, TradeSnapshot } from "../lib/workbenchTypes";

interface TradeReplayPanelProps {
  steps: TradeReplayStep[];
  snapshots: TradeSnapshot[];
}

export function TradeReplayPanel({ steps, snapshots }: TradeReplayPanelProps) {
  const snapshotsById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));

  return (
    <section className="data-panel replay-panel">
      <div className="panel-heading">
        <History size={16} />
        交易复盘
      </div>
      <ol className="replay-timeline">
        {steps.map((step) => {
          const snapshot = snapshotsById.get(step.snapshotId);
          return (
            <li key={`${step.stage}-${step.barIndex}`}>
              <time>
                {new Date(step.time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </time>
              <div>
                <strong>{formatReplayStage(step)}</strong>
                <span>{translateText(step.narrative)}</span>
                <em>
                  K线 {step.barIndex} | {translateText(step.outcome)} | {step.chartObjectIds.length} 个引用
                </em>
                {snapshot ? (
                  <span className="snapshot-line">
                    快照 {snapshot.candleWindow.startIndex}-{snapshot.candleWindow.endIndex} |{" "}
                    {snapshot.candles.length} 根K线 | {snapshot.chartObjects.length} 个对象
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
