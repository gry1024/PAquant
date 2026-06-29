import { History } from "lucide-react";
import type { TradeReplayStep } from "../lib/workbenchTypes";

interface TradeReplayPanelProps {
  steps: TradeReplayStep[];
}

export function TradeReplayPanel({ steps }: TradeReplayPanelProps) {
  return (
    <section className="data-panel replay-panel">
      <div className="panel-heading">
        <History size={16} />
        Trade replay
      </div>
      <ol className="replay-timeline">
        {steps.map((step) => (
          <li key={`${step.stage}-${step.barIndex}`}>
            <time>{new Date(step.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
            <div>
              <strong>{step.title}</strong>
              <span>{step.narrative}</span>
              <em>
                bar {step.barIndex} | {step.outcome} | {step.chartObjectIds.length} refs
              </em>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
