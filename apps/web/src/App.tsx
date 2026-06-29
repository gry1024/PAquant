import fixtureData from "./fixtures/paquant-demo.json";
import { Workbench } from "./components/Workbench";
import type { WorkbenchFixture } from "./lib/workbenchTypes";

const fixture = fixtureData as WorkbenchFixture;

export default function App() {
  return <Workbench fixture={fixture} />;
}
