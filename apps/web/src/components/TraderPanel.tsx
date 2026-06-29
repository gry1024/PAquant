import { Brain, CheckCircle2, CircleDollarSign, ShieldAlert } from "lucide-react";
import type { Analysis } from "../lib/workbenchTypes";

interface TraderPanelProps {
  analysis: Analysis;
}

export function TraderPanel({ analysis }: TraderPanelProps) {
  return (
    <aside className="trader-panel" aria-label="AI trader analysis">
      <div className="panel-heading">
        <Brain size={16} />
        Brooks Generalist
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
    </aside>
  );
}
