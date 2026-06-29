import fixtureData from "../fixtures/paquant-demo.json";
import type { WorkbenchFixture, WorkbenchMeta } from "./workbenchTypes";

const API_WORKBENCH_URL = "/api/workbench/demo";
const fixture = fixtureData as WorkbenchFixture;

export async function loadWorkbenchFixture(
  fetcher: typeof fetch = globalThis.fetch
): Promise<WorkbenchFixture> {
  try {
    const response = await fetcher(API_WORKBENCH_URL);
    if (!response.ok) {
      throw new Error(`PAquant API returned ${response.status}`);
    }
    const payload = (await response.json()) as WorkbenchFixture;
    return {
      ...payload,
      meta: payload.meta ?? apiMeta()
    };
  } catch {
    return {
      ...fixture,
      meta: fixtureMeta()
    };
  }
}

function apiMeta(): WorkbenchMeta {
  return {
    source: "api",
    symbol: "XAUUSD",
    timeframe: "5m",
    traderId: "brooks-generalist"
  };
}

function fixtureMeta(): WorkbenchMeta {
  return {
    source: "fixture",
    symbol: "XAUUSD",
    timeframe: "5m",
    traderId: "brooks-generalist"
  };
}
