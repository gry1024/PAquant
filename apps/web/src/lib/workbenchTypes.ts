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

export type ChartObject =
  | {
      kind: "trendline";
      id: string;
      label: string;
      anchors: [AnchorPoint, AnchorPoint];
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

export interface WorkbenchFixture {
  candles: Candle[];
  chartObjects: ChartObject[];
  analysis: Analysis;
  orders: SimulatedOrder[];
  trades: SimulatedTrade[];
  equityCurve: EquityPoint[];
  journal: JournalEntry[];
  knowledge: {
    version: string;
    concepts: Array<{ key: string; name: string; summary: string }>;
    setupDossiers: Array<{ key: string; name: string; context: string }>;
  };
}
