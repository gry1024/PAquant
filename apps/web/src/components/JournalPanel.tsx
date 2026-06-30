import { NotebookTabs } from "lucide-react";
import { translateText } from "../lib/displayText";
import type { JournalEntry } from "../lib/workbenchTypes";

interface JournalPanelProps {
  entries: JournalEntry[];
}

export function JournalPanel({ entries }: JournalPanelProps) {
  return (
    <section className="data-panel">
      <div className="panel-heading">
        <NotebookTabs size={16} />
        交易日志
      </div>
      <ol className="journal-list">
        {entries.map((entry) => (
          <li key={`${entry.time}-${entry.event}`}>
            <time>{new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
            <div>
              <strong>{translateText(entry.event)}</strong>
              <span>{translateText(entry.text)}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
