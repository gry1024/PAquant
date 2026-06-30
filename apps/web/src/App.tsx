import { Workbench } from "./components/Workbench";
import { loadTraderProfiles } from "./lib/traderProfiles";
import { loadModelProviders, loadWorkbenchFixture, startAgentRun } from "./lib/workbenchData";
import type { ModelProviderChoice, TraderProfile, WorkbenchFixture } from "./lib/workbenchTypes";
import { useEffect, useState } from "react";

export default function App() {
  const [workbenchFixture, setWorkbenchFixture] = useState<WorkbenchFixture | null>(null);
  const [traderProfiles, setTraderProfiles] = useState<TraderProfile[] | null>(null);
  const [modelProviders, setModelProviders] = useState<ModelProviderChoice[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([loadWorkbenchFixture(), loadTraderProfiles(), loadModelProviders()])
      .then(([loadedFixture, profiles, providers]) => {
        if (isMounted) {
          setWorkbenchFixture(loadedFixture);
          setTraderProfiles(profiles);
          setModelProviders(providers);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : "Failed to load live market data");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loadError) {
    return (
      <main className="loading-shell error-shell">
        <div className="loading-mark">PA</div>
        <span>Live market data unavailable</span>
        <small>{loadError}</small>
      </main>
    );
  }

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
      sourceLabel={workbenchFixture.meta?.source === "live" ? "Live market API" : "Local API"}
    />
  );
}
