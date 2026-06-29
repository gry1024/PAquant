import { NotebookTabs } from "lucide-react";
import type { JournalEntry } from "../lib/workbenchTypes";

interface JournalPanelProps {
  entries: JournalEntry[];
}

export function JournalPanel({ entries }: JournalPanelProps) {
  return (
    <section className="data-panel">
      <div className="panel-heading">
        <NotebookTabs size={16} />
        Replay journal
      </div>
      <ol className="journal-list">
        {entries.map((entry) => (
          <li key={`${entry.time}-${entry.event}`}>
            <time>{new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
            <div>
              <strong>{entry.event}</strong>
              <span>{entry.text}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
