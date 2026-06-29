import { UsersRound } from "lucide-react";
import type { TraderProfile } from "../lib/workbenchTypes";

interface TraderRosterPanelProps {
  profiles: TraderProfile[];
  activeTraderId: string;
}

export function TraderRosterPanel({ profiles, activeTraderId }: TraderRosterPanelProps) {
  return (
    <section className="trader-roster" aria-label="AI trader list">
      <div className="roster-heading">
        <span>
          <UsersRound size={16} />
          AI trader roster
        </span>
        <strong>{profiles.length} profiles</strong>
      </div>
      <div className="roster-grid">
        {profiles.map((profile) => {
          const isActive = profile.id === activeTraderId;
          return (
            <button
              key={profile.id}
              type="button"
              className={isActive ? "trader-roster-card active" : "trader-roster-card"}
              aria-pressed={isActive}
              title={profile.persona}
            >
              <span className="roster-status-row">
                <strong>{profile.name}</strong>
                <em>{profile.status}</em>
              </span>
              <span className="roster-action">{profile.recentAction}</span>
              <span className="roster-metrics">
                <span>WR {(profile.performance.winRate * 100).toFixed(0)}%</span>
                <span>DD {profile.performance.maxDrawdown.toFixed(1)}</span>
                <span>Eq {profile.performance.equity.toFixed(0)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
