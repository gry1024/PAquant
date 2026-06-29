import fixtureData from "../fixtures/paquant-demo.json";
import type { ModelProviderChoice, WorkbenchFixture, WorkbenchMeta } from "./workbenchTypes";

const API_WORKBENCH_URL = "/api/workbench/demo";
const API_MODEL_PROVIDERS_URL = "/api/model-providers";
const API_AGENT_RUNS_URL = "/api/agent-runs";
const fixture = fixtureData as WorkbenchFixture;
const fallbackProviders: ModelProviderChoice[] = [
  {
    id: "mock",
    name: "Mock local",
    model: "mock-brooks",
    apiKeyEnv: null,
    available: true,
    capabilities: {
      text: true,
      vision: false,
      structured_output: true,
      tool_calling: true,
      context_window: 16000
    }
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    model: "deepseek-chat",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    available: false,
    capabilities: {
      text: true,
      vision: false,
      structured_output: true,
      tool_calling: true,
      context_window: 64000
    }
  },
  {
    id: "qwen",
    name: "Qwen",
    model: "qwen-plus",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    available: false,
    capabilities: {
      text: true,
      vision: true,
      structured_output: true,
      tool_calling: true,
      context_window: 128000
    }
  },
  {
    id: "minimax",
    name: "MiniMax",
    model: "MiniMax-M1",
    apiKeyEnv: "MINIMAX_API_KEY",
    available: false,
    capabilities: {
      text: true,
      vision: false,
      structured_output: true,
      tool_calling: true,
      context_window: 80000
    }
  },
  {
    id: "kimi",
    name: "Kimi",
    model: "moonshot-v1-128k",
    apiKeyEnv: "MOONSHOT_API_KEY",
    available: false,
    capabilities: {
      text: true,
      vision: false,
      structured_output: true,
      tool_calling: true,
      context_window: 128000
    }
  }
];

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

export async function loadModelProviders(
  fetcher: typeof fetch = globalThis.fetch
): Promise<ModelProviderChoice[]> {
  try {
    const response = await fetcher(API_MODEL_PROVIDERS_URL);
    if (!response.ok) {
      throw new Error(`PAquant API returned ${response.status}`);
    }
    const payload = (await response.json()) as { providers: ModelProviderChoice[] };
    return payload.providers;
  } catch {
    return fallbackProviders;
  }
}

export async function startAgentRun(
  {
    traderId,
    modelProvider
  }: {
    traderId: string;
    modelProvider: string;
  },
  fetcher: typeof fetch = globalThis.fetch
): Promise<WorkbenchFixture> {
  try {
    const response = await fetcher(API_AGENT_RUNS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traderId, modelProvider })
    });
    if (!response.ok) {
      throw new Error(`PAquant API returned ${response.status}`);
    }
    return (await response.json()) as WorkbenchFixture;
  } catch {
    return {
      ...fixture,
      meta: {
        ...fixtureMeta(),
        modelProvider: fixture.analysis.modelUsage.provider,
        model: fixture.analysis.modelUsage.model,
        startedBy: "user",
        agentStatus: "completed"
      }
    };
  }
}

function apiMeta(): WorkbenchMeta {
  return {
    source: "api",
    symbol: "XAUUSD",
    timeframe: "5m",
    traderId: "brooks-generalist",
    modelProvider: "mock",
    model: "mock-brooks"
  };
}

function fixtureMeta(): WorkbenchMeta {
  return {
    source: "fixture",
    symbol: "XAUUSD",
    timeframe: "5m",
    traderId: "brooks-generalist",
    modelProvider: fixture.analysis.modelUsage.provider,
    model: fixture.analysis.modelUsage.model
  };
}
