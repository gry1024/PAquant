import { History } from "lucide-react";
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
        Trade replay
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
                <strong>{step.title}</strong>
                <span>{step.narrative}</span>
                <em>
                  bar {step.barIndex} | {step.outcome} | {step.chartObjectIds.length} refs
                </em>
                {snapshot ? (
                  <span className="snapshot-line">
                    Snapshot {snapshot.candleWindow.startIndex}-{snapshot.candleWindow.endIndex} |{" "}
                    {snapshot.candles.length} bars | {snapshot.chartObjects.length} objects
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
