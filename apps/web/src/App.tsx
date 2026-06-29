import { Workbench } from "./components/Workbench";
import { loadWorkbenchFixture } from "./lib/workbenchData";
import type { WorkbenchFixture } from "./lib/workbenchTypes";
import { useEffect, useState } from "react";

export default function App() {
  const [workbenchFixture, setWorkbenchFixture] = useState<WorkbenchFixture | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadWorkbenchFixture().then((loadedFixture) => {
      if (isMounted) {
        setWorkbenchFixture(loadedFixture);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!workbenchFixture) {
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
      sourceLabel={workbenchFixture.meta?.source === "api" ? "Local API" : "Fixture fallback"}
    />
  );
}
