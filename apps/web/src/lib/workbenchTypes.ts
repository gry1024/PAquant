export interface Candle {
  timestamp: string;
  symbol: "XAUUSD";
  timeframe: "5m";
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  body: number;
  range: number;
  close_position: number;
}

export interface AnchorPoint {
  time_index: number;
  price: number;
}

export interface TrendLineObject {
  kind: "trendline";
  id: string;
  label: string;
  anchors: [AnchorPoint, AnchorPoint];
}

export type ChartObject =
  | TrendLineObject
  | {
      kind: "channel";
      id: string;
      label: string;
      base: TrendLineObject;
      parallel_anchor: AnchorPoint;
    }
  | {
      kind: "range_box";
      id: string;
      label: string;
      start_index: number;
      end_index: number;
      high: number;
      low: number;
    }
  | {
      kind: "fibonacci";
      id: string;
      label: string;
      start: AnchorPoint;
      end: AnchorPoint;
      levels: Record<string, number>;
    }
  | {
      kind: "measured_move";
      id: string;
      label: string;
      start: AnchorPoint;
      end: AnchorPoint;
      projected_from: AnchorPoint;
      target_price: number;
    }
  | {
      kind: "three_push";
      id: string;
      label: string;
      pushes: AnchorPoint[];
    }
  | {
      kind: "trade_marker";
      id: string;
      label: string;
      time_index: number;
      price: number;
      marker_type: "entry" | "stop" | "target" | "fill";
    };

export interface KeyLevel {
  label: string;
  price: number;
  evidence: string;
}

export interface AgentAction {
  sequence: number;
  tool: string;
  status: "ok";
  observation: string;
  arguments: Record<string, unknown>;
  output: Record<string, unknown>;
  chartObjectId: string | null;
}

export interface Analysis {
  traderId: string;
  marketContext: string;
  alwaysInBias: "long" | "short" | "neutral";
  trendStrength: string;
  tradingRangeState: string;
  keyLevels: KeyLevel[];
  setupCandidate: string;
  invalidation: string;
  entryType: string;
  stop: number | null;
  target: number | null;
  confidence: number;
  reasoningSummary: string;
  evidenceTrail: string[];
  modelUsage: {
    provider: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number;
  };
}

export interface SimulatedOrder {
  id: string;
  symbol: string;
  timeframe: string;
  side: "buy" | "sell";
  order_type: "limit" | "market";
  entry: number;
  stop: number;
  target: number;
  quantity: number;
  setup_name: string;
  status: string;
}

export interface SimulatedTrade {
  order_id: string;
  symbol: string;
  timeframe: string;
  side: "buy" | "sell";
  setup_name: string;
  entry: number;
  stop: number;
  target: number;
  exit: number;
  quantity: number;
  risk_points: number;
  mfe_points: number;
  mae_points: number;
  max_favorable_r: number;
  max_adverse_r: number;
  pnl: number;
  r_multiple: number;
  outcome: string;
}

export interface EquityPoint {
  time: string;
  equity: number;
}

export interface JournalEntry {
  time: string;
  event: string;
  text: string;
}

export interface SetupPerformance {
  setup_name: string;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl: number;
  total_r: number;
  average_r: number;
}

export interface PerformanceSummary {
  starting_equity: number;
  ending_equity: number;
  total_trades: number;
  win_rate: number;
  net_pnl: number;
  max_drawdown: number;
  setup_stats: SetupPerformance[];
}

export interface WorkbenchMeta {
  source: "api" | "fixture";
  symbol: "XAUUSD";
  timeframe: "5m";
  traderId: string;
  analysisRunId?: number;
  persisted?: boolean;
  recordCounts?: Record<string, number>;
}

export interface TraderProfile {
  id: string;
  name: string;
  persona: string;
  status: "active" | "standby" | "research";
  symbol: "XAUUSD";
  timeframe: "5m";
  preferredSetups: string[];
  riskStyle: string;
  toolPermissions: string[];
  knowledgePolicy: string;
  recentAction: string;
  performance: {
    equity: number;
    winRate: number;
    maxDrawdown: number;
    trades: number;
    averageR: number;
  };
}

export interface KnowledgeSource {
  id: string;
  title: string;
  sourceType: "local_pdf";
  themes: string[];
  chapterRefs: string[];
}

export interface KnowledgeConcept {
  key: string;
  name: string;
  summary: string;
  sourceRefs: string[];
  questions: string[];
}

export interface SetupDossier {
  key: string;
  name: string;
  context: string;
  observations: string[];
  measurements: string[];
  entryStyles: string[];
  stopLogic: string[];
  targets: string[];
  management: string[];
  failureModes: string[];
  nearbySetups: string[];
  sourceRefs: string[];
}

export interface CaseCard {
  key: string;
  title: string;
  sourceRefs: string[];
  chartContext: string;
  patternInterpretation: string;
  traderThinking: string;
  expectedFollowThrough: string;
  failureScenario: string;
}

export interface ReasoningPlaybook {
  key: string;
  name: string;
  questions: string[];
  requiredObservations: string[];
  invalidationChecks: string[];
  displayGuardrails: string[];
}

export interface KnowledgeBrowser {
  version: string;
  sources: KnowledgeSource[];
  concepts: KnowledgeConcept[];
  setupDossiers: SetupDossier[];
  caseCards: CaseCard[];
  reasoningPlaybooks: ReasoningPlaybook[];
}

export interface WorkbenchFixture {
  meta?: WorkbenchMeta;
  candles: Candle[];
  agentActions: AgentAction[];
  chartObjects: ChartObject[];
  analysis: Analysis;
  orders: SimulatedOrder[];
  trades: SimulatedTrade[];
  equityCurve: EquityPoint[];
  performanceSummary: PerformanceSummary;
  journal: JournalEntry[];
  knowledge: KnowledgeBrowser;
}
