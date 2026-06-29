import { Workbench } from "./components/Workbench";
import { loadTraderProfiles } from "./lib/traderProfiles";
import { loadModelProviders, loadWorkbenchFixture, startAgentRun } from "./lib/workbenchData";
import type { ModelProviderChoice, TraderProfile, WorkbenchFixture } from "./lib/workbenchTypes";
import { useEffect, useState } from "react";

export default function App() {
  const [workbenchFixture, setWorkbenchFixture] = useState<WorkbenchFixture | null>(null);
  const [traderProfiles, setTraderProfiles] = useState<TraderProfile[] | null>(null);
  const [modelProviders, setModelProviders] = useState<ModelProviderChoice[] | null>(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([loadWorkbenchFixture(), loadTraderProfiles(), loadModelProviders()]).then(
      ([loadedFixture, profiles, providers]) => {
        if (isMounted) {
          setWorkbenchFixture(loadedFixture);
          setTraderProfiles(profiles);
          setModelProviders(providers);
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, []);

  if (!workbenchFixture || !traderProfiles || !modelProviders) {
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
      modelProviders={modelProviders}
      onStartAgentRun={(traderId, modelProvider) => startAgentRun({ traderId, modelProvider })}
      sourceLabel={workbenchFixture.meta?.source === "api" ? "Local API" : "Fixture fallback"}
    />
  );
}
