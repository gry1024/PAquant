import { Brain, CheckCircle2, CircleDollarSign, ShieldAlert, Wrench } from "lucide-react";
import type { AgentAction, Analysis } from "../lib/workbenchTypes";

interface TraderPanelProps {
  analysis: Analysis;
  actions: AgentAction[];
  traderName: string;
}

export function TraderPanel({ analysis, actions, traderName }: TraderPanelProps) {
  return (
    <aside className="trader-panel" aria-label="AI trader analysis">
      <div className="panel-heading">
        <Brain size={16} />
        {traderName}
      </div>
      <div className="bias-board">
        <div>
          <span>Always-in bias</span>
          <strong>{analysis.alwaysInBias}</strong>
        </div>
        <div>
          <span>Confidence</span>
          <strong>{Math.round(analysis.confidence * 100)}%</strong>
        </div>
      </div>
      <section className="analysis-section">
        <h2>Market context</h2>
        <p>{analysis.marketContext}</p>
      </section>
      <section className="analysis-section">
        <h2>Trade thesis</h2>
        <p>{analysis.reasoningSummary}</p>
        <div className="thesis-grid">
          <span>
            <CircleDollarSign size={14} />
            {analysis.entryType}
          </span>
          <span>
            <ShieldAlert size={14} />
            Stop {analysis.stop}
          </span>
          <span>
            <CheckCircle2 size={14} />
            Target {analysis.target}
          </span>
        </div>
      </section>
      <section className="analysis-section">
        <h2>Key levels</h2>
        <ul className="level-list">
          {analysis.keyLevels.map((level) => (
            <li key={level.label}>
              <strong>{level.price.toFixed(2)}</strong>
              <span>{level.label}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="analysis-section">
        <h2>Evidence rail</h2>
        <ol className="evidence-rail">
          {analysis.evidenceTrail.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
      <section className="analysis-section">
        <h2>
          <Wrench size={13} />
          Tool actions
        </h2>
        <ol className="action-stream">
          {actions.map((action) => (
            <li key={`${action.sequence}-${action.tool}`}>
              <span>{action.sequence}</span>
              <div>
                <strong>{action.tool}</strong>
                <small>{action.observation}</small>
              </div>
              <em>{formatActionOutput(action)}</em>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

function formatActionOutput(action: AgentAction) {
  const output = action.output;
  const points = output.points;
  if (typeof points === "number") {
    return `${points.toFixed(2)} pts`;
  }
  const bars = output.bars;
  if (typeof bars === "number") {
    return `${bars} bars`;
  }
  const swings = output.swings;
  if (Array.isArray(swings)) {
    return `${swings.length} swings`;
  }
  const price = output.price;
  if (typeof price === "number") {
    return `${price.toFixed(2)}`;
  }
  return action.chartObjectId ?? action.status;
}
