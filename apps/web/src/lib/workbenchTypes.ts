export interface Candle {
  timestamp: string;
  symbol: "XAUUSD";
  timeframe: "5m" | "quote";
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  body: number;
  range: number;
  close_position: number;
}

export interface HigherTimeframeContext {
  timeframe: "15m" | "1h";
  bars: number;
  bias: "long" | "short" | "neutral";
  high: number;
  low: number;
  last_close: number;
  summary: string;
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
  reason?: string | null;
}

export type ChartObject =
  | TrendLineObject
  | {
      kind: "channel";
      id: string;
      label: string;
      base: TrendLineObject;
      parallel_anchor: AnchorPoint;
      reason?: string | null;
    }
  | {
      kind: "range_box";
      id: string;
      label: string;
      start_index: number;
      end_index: number;
      high: number;
      low: number;
      reason?: string | null;
    }
  | {
      kind: "fibonacci";
      id: string;
      label: string;
      start: AnchorPoint;
      end: AnchorPoint;
      levels: Record<string, number>;
      reason?: string | null;
    }
  | {
      kind: "measured_move";
      id: string;
      label: string;
      start: AnchorPoint;
      end: AnchorPoint;
      projected_from: AnchorPoint;
      target_price: number;
      reason?: string | null;
    }
  | {
      kind: "three_push";
      id: string;
      label: string;
      pushes: AnchorPoint[];
      reason?: string | null;
    }
  | {
      kind: "trade_marker";
      id: string;
      label: string;
      time_index: number;
      start_index?: number | null;
      end_index?: number | null;
      price: number;
      marker_type: "entry" | "stop" | "target" | "fill";
      quantity?: number | null;
      reason?: string | null;
    };

export interface KeyLevel {
  label: string;
  price: number;
  evidence: string;
}

export interface KnowledgeRef {
  artifactType: "concept" | "setup_dossier" | "case_card" | "reasoning_playbook";
  key: string;
  title: string;
  summary: string;
  sourceRefs: string[];
  score: number;
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
  positionSizeSuggestion: number;
  noTradeReason: string | null;
  confidence: number;
  reasoningSummary: string;
  knowledgeRefs: KnowledgeRef[];
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
  order_type: "limit" | "market" | "stop" | "stop_limit";
  activation_price?: number | null;
  execution_plan?: {
    order_type_label: string;
    signal_bar_index: number;
    signal_bar_time: string;
    signal_bar_pattern: string;
    trigger_price: number;
    trigger_condition: string;
    entry_tactic: string;
  };
  entry: number;
  filled_entry?: number | null;
  stop: number;
  target: number;
  quantity: number;
  setup_name: string;
  reason: string;
  status: "submitted" | "triggered" | "filled" | "canceled" | "closed" | string;
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

export interface TradeReplayStep {
  stage: "pre-entry" | "plan" | "execution" | "outcome" | "post-trade review";
  snapshotId: string;
  title: string;
  time: string;
  barIndex: number;
  chartObjectIds: string[];
  orderId: string | null;
  outcome: string;
  narrative: string;
}

export interface TradeSnapshot {
  id: string;
  tradeOrderId: string;
  stage: TradeReplayStep["stage"];
  capturedAt: string;
  candleWindow: {
    startIndex: number;
    endIndex: number;
    symbol: "XAUUSD";
    timeframe: "5m";
  };
  candles: Candle[];
  chartObjectIds: string[];
  chartObjects: ChartObject[];
  analysisSummary: string;
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

export interface LiveMarketSource {
  id: string;
  label: string;
  instrumentSymbol: "XAUUSD" | string;
  instrumentKind: "spot" | "spot_quote" | "futures_proxy" | string;
  isSpot: boolean;
  isMock: boolean;
  historyCompleteness?: "intraday_5m" | "latest_quote_only" | string;
  latency: "live" | "near_realtime" | "delayed" | string;
}

export interface LiveMarketQuote {
  symbol: "XAUUSD";
  price: number;
  bid?: number;
  ask?: number;
  timestamp: string;
  providerSymbol: string;
}

export interface LiveMarketPayload {
  source: LiveMarketSource;
  quote: LiveMarketQuote;
  candles: Candle[];
}

export interface WorkbenchMeta {
  source: "api" | "fixture" | "live";
  symbol: "XAUUSD";
  timeframe: "5m";
  traderId: string;
  modelProvider?: string;
  model?: string;
  startedBy?: string;
  agentStatus?: "idle" | "running" | "completed" | "failed" | string;
  analysisRunId?: number;
  persisted?: boolean;
  recordCounts?: Record<string, number>;
  dataSource?: LiveMarketSource;
  quote?: LiveMarketQuote;
}

export interface ModelProviderChoice {
  id: string;
  name: string;
  model: string;
  apiKeyEnv: string | null;
  available: boolean;
  capabilities: {
    text: boolean;
    vision: boolean;
    structured_output: boolean;
    tool_calling: boolean;
    context_window: number;
  };
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
  agentFile: string;
  sharedKnowledgeFiles: string[];
  sharedKnowledgeSummary: string;
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
  sourceType: "local_pdf" | "official_web";
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

export interface KnowledgeChapter {
  sourceId: string;
  part: string;
  title: string;
  summary: string;
  conceptKeys: string[];
}

export interface ConceptEdge {
  source: string;
  target: string;
  relation: string;
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
  diagram: {
    kind: "wedge" | "failed_breakout";
    caption: string;
    points: Array<{
      label: string;
      x: number;
      y: number;
      role: "push" | "breakout" | "reentry" | "target" | "failure";
    }>;
    levels: Array<{
      label: string;
      y: number;
    }>;
  };
}

export interface ReasoningPlaybook {
  key: string;
  name: string;
  questions: string[];
  requiredObservations: string[];
  invalidationChecks: string[];
  displayGuardrails: string[];
}

export interface GlossaryTerm {
  english: string;
  chinese: string;
  abbreviation: string | null;
  definition: string;
  sourceRefs: string[];
}

export interface KnowledgeBrowser {
  version: string;
  sources: KnowledgeSource[];
  chapterMap: KnowledgeChapter[];
  concepts: KnowledgeConcept[];
  conceptEdges: ConceptEdge[];
  setupDossiers: SetupDossier[];
  caseCards: CaseCard[];
  reasoningPlaybooks: ReasoningPlaybook[];
  glossary: GlossaryTerm[];
}

export interface WorkbenchFixture {
  meta?: WorkbenchMeta;
  candles: Candle[];
  higherTimeframeContext: HigherTimeframeContext[];
  agentActions: AgentAction[];
  chartObjects: ChartObject[];
  analysis: Analysis;
  orders: SimulatedOrder[];
  trades: SimulatedTrade[];
  tradeSnapshots: TradeSnapshot[];
  tradeReplay: TradeReplayStep[];
  equityCurve: EquityPoint[];
  performanceSummary: PerformanceSummary;
  journal: JournalEntry[];
  knowledge: KnowledgeBrowser;
}
