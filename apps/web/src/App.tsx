import { Workbench } from "./components/Workbench";
import { loadTraderProfiles } from "./lib/traderProfiles";
import { loadWorkbenchFixture } from "./lib/workbenchData";
import type { TraderProfile, WorkbenchFixture } from "./lib/workbenchTypes";
import { useEffect, useState } from "react";

export default function App() {
  const [workbenchFixture, setWorkbenchFixture] = useState<WorkbenchFixture | null>(null);
  const [traderProfiles, setTraderProfiles] = useState<TraderProfile[] | null>(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([loadWorkbenchFixture(), loadTraderProfiles()]).then(([loadedFixture, profiles]) => {
      if (isMounted) {
        setWorkbenchFixture(loadedFixture);
        setTraderProfiles(profiles);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!workbenchFixture || !traderProfiles) {
    return (
      <main className="loading-shell">
        <div className="loading-mark">PA</div>
        <span>Loading PAquant workstation</span>
      </main>
    );
  }

  return (
    <Workbench
      fixture={workbenchFixture}
      traderProfiles={traderProfiles}
      sourceLabel={workbenchFixture.meta?.source === "api" ? "Local API" : "Fixture fallback"}
    />
  );
}
