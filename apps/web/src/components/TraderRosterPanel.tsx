import { UsersRound } from "lucide-react";
import { traderDisplayName } from "../lib/displayText";
import type { TraderProfile } from "../lib/workbenchTypes";

interface TraderRosterPanelProps {
  profiles: TraderProfile[];
  activeTraderId: string;
  onSelect: (traderId: string) => void;
}

export function TraderRosterPanel({ profiles, activeTraderId, onSelect }: TraderRosterPanelProps) {
  return (
    <section className="trader-roster" aria-label="AI交易员名单">
      <div className="roster-heading">
        <span>
          <UsersRound size={16} />
          AI交易员图谱
        </span>
        <strong>{profiles.length} 位交易员</strong>
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
              onClick={() => onSelect(profile.id)}
              title={profile.persona}
            >
              <span className="roster-status-row">
                <strong>{traderDisplayName(profile)}</strong>
                <em>{profile.status}</em>
              </span>
              <code className="roster-source">{profile.agentFile}</code>
              <span className="roster-action">{profile.recentAction}</span>
              <span className="roster-metrics">
                <span>胜率 {(profile.performance.winRate * 100).toFixed(0)}%</span>
                <span>回撤 {profile.performance.maxDrawdown.toFixed(1)}</span>
                <span>权益 {profile.performance.equity.toFixed(0)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
