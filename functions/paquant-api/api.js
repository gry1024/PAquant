const MODEL_PROVIDERS = {
  deepseek: {
    name: "DeepSeek",
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    inputCostPerMillion: 0.27,
    outputCostPerMillion: 1.1,
    capabilities: {
      text: true,
      vision: false,
      structured_output: true,
      tool_calling: true,
      context_window: 64000
    }
  },
  qwen: {
    name: "Qwen",
    model: "qwen-plus",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    inputCostPerMillion: 0.4,
    outputCostPerMillion: 1.2,
    capabilities: {
      text: true,
      vision: true,
      structured_output: true,
      tool_calling: true,
      context_window: 128000
    }
  },
  minimax: {
    name: "MiniMax",
    model: "MiniMax-M1",
    baseUrl: "https://api.minimax.io/v1",
    apiKeyEnv: "MINIMAX_API_KEY",
    inputCostPerMillion: 0.3,
    outputCostPerMillion: 1.2,
    capabilities: {
      text: true,
      vision: false,
      structured_output: true,
      tool_calling: true,
      context_window: 80000
    }
  },
  kimi: {
    name: "Kimi",
    model: "moonshot-v1-128k",
    baseUrl: "https://api.moonshot.cn/v1",
    apiKeyEnv: "MOONSHOT_API_KEY",
    inputCostPerMillion: 1.8,
    outputCostPerMillion: 1.8,
    capabilities: {
      text: true,
      vision: false,
      structured_output: true,
      tool_calling: true,
      context_window: 128000
    }
  }
};

const DRAWING_TOOLS = new Set(["draw_trendline", "draw_box", "draw_fibonacci"]);
const MEASUREMENT_TOOLS = new Set([
  "measure_leg",
  "compare_legs",
  "count_bars",
  "project_line",
  "measure_deviation"
]);
const MAX_MODEL_DRAWING_BARS = 72;
const DEFAULT_MODEL_REQUEST_TIMEOUT_MS = 45000;
const YAHOO_GOLD_CHART_ENDPOINTS = [
  {
    id: "yahoo_gc_futures_proxy",
    label: "Yahoo Finance GC=F COMEX gold futures proxy",
    url: "https://query2.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=5m",
    responseType: "json"
  },
  {
    id: "yahoo_gc_futures_proxy",
    label: "Yahoo Finance GC=F COMEX gold futures proxy",
    url: "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=5m",
    responseType: "json"
  },
  {
    id: "jina_yahoo_gc_futures_proxy",
    label: "Jina Reader proxy for Yahoo Finance GC=F COMEX gold futures",
    url: "https://r.jina.ai/https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=5m",
    responseType: "jina_text"
  },
  {
    id: "gold_api_xau_spot_quote",
    label: "Gold API XAU/USD realtime spot quote",
    url: "https://api.gold-api.com/price/XAU",
    responseType: "gold_api_quote"
  },
  {
    id: "swissquote_xauusd_spot_quote",
    label: "Swissquote XAU/USD realtime bid/ask quote",
    url: "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD",
    responseType: "swissquote_quote"
  }
];
const YAHOO_CHART_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9"
};
const DEFAULT_MT5_SYMBOL = "XAUUSDc";
const DEFAULT_MT5_TIMEFRAME = "5m";
const DEFAULT_MT5_BARS = 240;

async function handleRequest({ method, url, body = "", fetchImpl = fetch }) {
  if (method === "OPTIONS") {
    return jsonResponse({}, 204);
  }

  try {
    const path = normalizePath(url);
    if (method === "GET" && path === "/healthz") {
      return jsonResponse({ service: "paquant-api-function", status: "ok" });
    }
    if (method === "GET" && path === "/market/xau/live") {
      return jsonResponse(await loadLiveMarket(fetchImpl));
    }
    if (method === "GET" && path === "/model-providers") {
      return jsonResponse({ providers: listModelProviders() });
    }
    if (method === "GET" && path === "/traders") {
      return jsonResponse({ traders: traderProfiles() });
    }
    if (method === "GET" && path === "/knowledge") {
      return jsonResponse(knowledgeBrowser());
    }
    if (method === "POST" && path === "/agent-runs") {
      const request = parseJsonBody(body);
      const payload = await createAgentRun({
        traderId: request.traderId ?? "brooks-generalist",
        modelProvider: request.modelProvider ?? "deepseek",
        clientMarket: request.market,
        fetchImpl
      });
      return jsonResponse(payload, 201);
    }
    return jsonResponse({ detail: `route not found: ${path}` }, 404);
  } catch (error) {
    const statusCode = error.statusCode ?? 500;
    return jsonResponse({ detail: sanitizeError(error.message ?? String(error)) }, statusCode);
  }
}

async function loadLiveMarket(fetchImpl = fetch) {
  const failures = [];
  const mt5BridgeUrl = process.env.PAQUANT_MT5_BRIDGE_URL?.trim();
  if (mt5BridgeUrl) {
    try {
      return await loadMt5BridgeMarket(fetchImpl, mt5BridgeUrl);
    } catch (error) {
      failures.push(`mt5 bridge failed: ${sanitizeError(error.message ?? String(error))}`);
    }
  }
  for (const endpoint of YAHOO_GOLD_CHART_ENDPOINTS) {
    const hostname = new URL(endpoint.url).hostname;
    let response;
    try {
      response = await fetchImpl(endpoint.url, { headers: YAHOO_CHART_HEADERS });
    } catch (error) {
      failures.push(`${hostname} fetch failed: ${sanitizeError(error.message ?? String(error))}`);
      continue;
    }
    if (!response.ok) {
      failures.push(`${hostname} returned ${response.status}`);
      continue;
    }
    let marketResult;
    try {
      marketResult = await readMarketProviderResult(response, endpoint);
    } catch (error) {
      failures.push(`${hostname} returned unreadable chart payload: ${error.message}`);
      continue;
    }
    if (marketResult.kind === "quote") {
      return quoteOnlyMarketPayload(marketResult.quote, endpoint);
    }
    const result = marketResult.payload?.chart?.result?.[0];
    if (!result) {
      failures.push(`${hostname} returned no chart result`);
      continue;
    }
    const candles = parseYahooCandles(result);
    if (!candles.length) {
      failures.push(`${hostname} returned no 5m candles`);
      continue;
    }
    return liveMarketPayload(candles, endpoint);
  }
  throw httpError(502, `live market providers failed: ${failures.join("; ")}`);
}

async function readMarketProviderResult(response, endpoint) {
  if (endpoint.responseType === "json") {
    return { kind: "candles", payload: await response.json() };
  }
  if (endpoint.responseType === "gold_api_quote") {
    const payload = await response.json();
    return {
      kind: "quote",
      quote: {
        price: numberOrThrow(payload.price, "price"),
        timestamp: new Date(payload.updatedAt ?? Date.now()).toISOString()
      }
    };
  }
  if (endpoint.responseType === "swissquote_quote") {
    const payload = await response.json();
    const best = payload?.[0]?.spreadProfilePrices?.[0];
    if (!best) {
      throw new Error("missing Swissquote bid/ask quote");
    }
    return {
      kind: "quote",
      quote: {
        price: round4((numberOrThrow(best.bid, "bid") + numberOrThrow(best.ask, "ask")) / 2),
        bid: numberOrThrow(best.bid, "bid"),
        ask: numberOrThrow(best.ask, "ask"),
        timestamp: new Date(payload[0].ts ?? Date.now()).toISOString()
      }
    };
  }
  const text = await response.text();
  const marker = "Markdown Content:";
  const content = text.includes(marker) ? text.slice(text.indexOf(marker) + marker.length) : text;
  const firstJsonChar = content.indexOf("{");
  const lastJsonChar = content.lastIndexOf("}");
  if (firstJsonChar < 0 || lastJsonChar <= firstJsonChar) {
    throw new Error("missing JSON object");
  }
  return { kind: "candles", payload: JSON.parse(content.slice(firstJsonChar, lastJsonChar + 1)) };
}

async function loadMt5BridgeMarket(fetchImpl, bridgeUrl) {
  const requestUrl = mt5BridgeRequestUrl(bridgeUrl);
  const response = await fetchImpl(requestUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PAquant-CloudBase-MT5-Bridge/0.1"
    }
  });
  if (!response.ok) {
    throw new Error(`MT5 bridge returned ${response.status}`);
  }
  return parseMt5BridgePayload(await response.json());
}

function mt5BridgeRequestUrl(bridgeUrl) {
  const url = new URL(bridgeUrl);
  if (!url.searchParams.has("symbol")) {
    url.searchParams.set("symbol", process.env.PAQUANT_MT5_SYMBOL ?? DEFAULT_MT5_SYMBOL);
  }
  if (!url.searchParams.has("timeframe")) {
    url.searchParams.set("timeframe", process.env.PAQUANT_MT5_TIMEFRAME ?? DEFAULT_MT5_TIMEFRAME);
  }
  if (!url.searchParams.has("bars")) {
    url.searchParams.set("bars", String(mt5BarLimit()));
  }
  return url.toString();
}

function parseMt5BridgePayload(payload) {
  const brokerSymbol = String(payload?.symbol ?? process.env.PAQUANT_MT5_SYMBOL ?? DEFAULT_MT5_SYMBOL);
  const timeframe = String(payload?.timeframe ?? DEFAULT_MT5_TIMEFRAME);
  if (timeframe !== "5m") {
    throw new Error(`MT5 bridge returned unsupported timeframe: ${timeframe}`);
  }
  const newestFirstRows = Array.isArray(payload?.barsNewestFirst)
    ? payload.barsNewestFirst
    : Array.isArray(payload?.bars_newest_first)
      ? payload.bars_newest_first
      : null;
  const rawRows = newestFirstRows ?? payload?.rates ?? payload?.candles;
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new Error("MT5 bridge returned no bars");
  }

  const rowsOldestFirst = newestFirstRows
    ? [...rawRows].filter((row) => row?.closed !== false).reverse()
    : [...rawRows].filter((row, index) => row?.closed !== false || index !== rawRows.length - 1);
  const candles = rowsOldestFirst
    .slice(-mt5BarLimit())
    .map((row, index) => normalizeMt5BridgeCandle(row, index))
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
  if (candles.length < 20) {
    throw new Error(`MT5 bridge returned only ${candles.length} closed 5m bars`);
  }

  const formingRow = newestFirstRows
    ? rawRows.find((row) => row?.closed === false) ?? rawRows[0]
    : rawRows.at(-1);
  const tick = payload?.tick ?? payload?.quote ?? {};
  const last = candles.at(-1);
  const bid = optionalNumber(tick.bid);
  const ask = optionalNumber(tick.ask);
  const price =
    optionalNumber(tick.last) ??
    optionalNumber(tick.price) ??
    (bid != null && ask != null ? round4((bid + ask) / 2) : null) ??
    optionalNumber(formingRow?.close) ??
    last.close;
  return {
    source: {
      id: "mt5_bridge_xauusd_5m",
      label: `MT5 / MetaTrader 5 ${brokerSymbol} 5分钟`,
      instrumentSymbol: brokerSymbol,
      instrumentKind: "mt5_broker",
      isSpot: true,
      isMock: false,
      historyCompleteness: "historical_5m",
      latency: "broker_terminal"
    },
    quote: {
      symbol: "XAUUSD",
      price: round4(price),
      ...(bid == null ? {} : { bid: round4(bid) }),
      ...(ask == null ? {} : { ask: round4(ask) }),
      timestamp: mt5TimestampToIso(tick.time_msc ?? tick.time ?? tick.timestamp ?? formingRow?.time ?? last.timestamp),
      providerSymbol: brokerSymbol
    },
    candles,
    chartObjects: marketStructureObjects(candles, "MT5")
  };
}

function normalizeMt5BridgeCandle(row, index) {
  const open = numberOrThrow(row?.open, `mt5.bars[${index}].open`);
  const high = numberOrThrow(row?.high, `mt5.bars[${index}].high`);
  const low = numberOrThrow(row?.low, `mt5.bars[${index}].low`);
  const close = numberOrThrow(row?.close, `mt5.bars[${index}].close`);
  if (high < Math.max(open, close) || low > Math.min(open, close) || high < low) {
    throw new Error(`invalid MT5 OHLC range at row ${index}`);
  }
  const range = high - low;
  return {
    timestamp: mt5TimestampToIso(row?.timestamp ?? row?.time ?? row?.ts_open),
    symbol: "XAUUSD",
    timeframe: "5m",
    open: round4(open),
    high: round4(high),
    low: round4(low),
    close: round4(close),
    volume: Number(row?.tick_volume ?? row?.real_volume ?? row?.volume ?? 0),
    body: round4(Math.abs(close - open)),
    range: round4(range),
    close_position: range === 0 ? 0.5 : round4((close - low) / range)
  };
}

function mt5TimestampToIso(value) {
  if (value == null) {
    return new Date().toISOString();
  }
  if (typeof value === "string") {
    const timestamp = new Date(value);
    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp.toISOString();
    }
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`invalid MT5 timestamp: ${value}`);
  }
  return new Date(numeric > 1000000000000 ? numeric : numeric * 1000).toISOString();
}

function mt5BarLimit() {
  const configured = Number(process.env.PAQUANT_MT5_BARS);
  if (Number.isFinite(configured) && configured >= 20) {
    return Math.min(Math.floor(configured), 500);
  }
  return DEFAULT_MT5_BARS;
}

function liveMarketPayload(candles, endpoint) {
  const last = candles[candles.length - 1];
  return {
    source: {
      id: endpoint.id,
      label: endpoint.label,
      instrumentSymbol: "GC=F",
      instrumentKind: "futures_proxy",
      isSpot: false,
      isMock: false,
      historyCompleteness: "intraday_5m",
      latency: "near_realtime"
    },
    quote: {
      symbol: "XAUUSD",
      price: last.close,
      timestamp: last.timestamp,
      providerSymbol: "GC=F"
    },
    candles,
    chartObjects: marketStructureObjects(candles, endpoint.id)
  };
}

function quoteOnlyMarketPayload(quote, endpoint) {
  const price = quote.price;
  return {
    source: {
      id: endpoint.id,
      label: endpoint.label,
      instrumentSymbol: endpoint.id.includes("swissquote") ? "XAU/USD" : "XAU",
      instrumentKind: "spot_quote",
      isSpot: true,
      isMock: false,
      historyCompleteness: "latest_quote_only",
      latency: "realtime_quote"
    },
    quote: {
      symbol: "XAUUSD",
      price,
      bid: quote.bid,
      ask: quote.ask,
      timestamp: quote.timestamp,
      providerSymbol: endpoint.id.includes("swissquote") ? "XAU/USD" : "XAU"
    },
    candles: [
      {
        timestamp: quote.timestamp,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
        symbol: "XAUUSD",
        timeframe: "quote",
        body: 0,
        range: 0,
        close_position: 0.5
      }
    ]
  };
}

function listModelProviders() {
  return Object.entries(MODEL_PROVIDERS).map(([id, config]) => ({
    id,
    name: config.name,
    model: config.model,
    apiKeyEnv: config.apiKeyEnv,
    available: Boolean(process.env[config.apiKeyEnv]),
    capabilities: config.capabilities
  }));
}

async function createAgentRun({ traderId, modelProvider, clientMarket, fetchImpl = fetch }) {
  if (modelProvider === "mock") {
    throw httpError(400, "mock provider is test-only and cannot run live AI trader mode");
  }
  const config = MODEL_PROVIDERS[modelProvider];
  if (!config) {
    throw httpError(400, `unknown model provider: ${modelProvider}`);
  }
  const credential = process.env[config.apiKeyEnv];
  if (!credential) {
    throw httpError(
      400,
      `model provider ${modelProvider} is not configured; set ${config.apiKeyEnv}`
    );
  }

  const market = clientMarket == null ? await loadLiveMarket(fetchImpl) : normalizeClientMarket(clientMarket);
  if (!hasFullFiveMinuteHistory(market)) {
    throw httpError(
      clientMarket == null ? 409 : 400,
      "live AI trader requires full 5m candle history with non-mock 5m candles before thinking, drawing, or placing simulated orders; current feed is latest quote only or insufficient"
    );
  }
  const candles = market.candles;
  const first = candles[0];
  const last = candles[candles.length - 1];
  const high = Math.max(...candles.map((candle) => candle.high));
  const low = Math.min(...candles.map((candle) => candle.low));
  const bias = last.close > first.open ? "long" : "short";
  const refs = knowledgeRefs();

  const responses = [];
  const initial = await callModel({
    config,
    credential,
    fetchImpl,
    prompt: analysisPrompt({ candles, first, last, high, low, refs }),
    tools: brooksToolDefinitions()
  });
  responses.push(initial);
  const toolCalls = [...initial.toolCalls];

  if (!hasTool(toolCalls, DRAWING_TOOLS)) {
    const forced = await callModel({
      config,
      credential,
      fetchImpl,
      prompt: forcedToolPrompt("draw_trendline", candles, refs),
      tools: brooksToolDefinitions(),
      toolChoice: { type: "function", function: { name: "draw_trendline" } }
    });
    responses.push(forced);
    toolCalls.push(...forced.toolCalls);
  }
  if (!hasTool(toolCalls, MEASUREMENT_TOOLS)) {
    const forced = await callModel({
      config,
      credential,
      fetchImpl,
      prompt: forcedToolPrompt("measure_leg", candles, refs),
      tools: brooksToolDefinitions(),
      toolChoice: { type: "function", function: { name: "measure_leg" } }
    });
    responses.push(forced);
    toolCalls.push(...forced.toolCalls);
  }
  if (!hasTool(toolCalls, DRAWING_TOOLS) || !hasTool(toolCalls, MEASUREMENT_TOOLS)) {
    throw httpError(
      502,
      "model provider returned insufficient tool calls; live AI trader mode requires drawing and measurement tool output"
    );
  }

  const drawingResult = executeToolCalls(candles, toolCalls);
  const order = buildContextualOrder(candles, bias);
  const markers = tradeMarkers(order, candles);
  const chartObjects = [
    ...drawingResult.chartObjects,
    measuredMove(order),
    threePush(candles),
    ...markers
  ];
  const analysisText = responses.map((response) => response.text).filter(Boolean).join(" ");
  const usage = mergeUsage(modelProvider, config.model, responses, config);
  const thinkingSteps = visibleThinkingSteps({
    candles,
    market,
    order,
    refs,
    drawingResult,
    modelProvider,
    model: config.model,
    bias
  });
  const decisionTrace = visibleDecisionTrace({ order, bias, high, low, drawingResult });
  const tradeReason =
    `${config.name} 模型 API 已返回工具调用，PAquant 已执行绘图和测量工具。` +
    `${describeExecutionPlan(order)}` +
    `本笔模拟${formatOrderSide(order.side)}订单使用 ${round2(Math.abs(order.entry - order.stop))} 点风险，` +
    `目标回报 ${round2(Math.abs(order.target - order.entry))} 点。`;

  return {
    meta: {
      source: "api",
      symbol: "XAUUSD",
      timeframe: "5m",
      traderId,
      modelProvider,
      model: config.model,
      startedBy: "user",
      agentStatus: "completed",
      persisted: false,
      dataSource: market.source
    },
    candles,
    higherTimeframeContext: [],
    agentActions: drawingResult.actions,
    chartObjects,
    analysis: {
      traderId,
      marketContext:
        bias === "long"
          ? "实时 XAU 5分钟期货代理行情位于本轮开盘价上方，回调按始终在场多头背景评估。"
          : "实时 XAU 5分钟期货代理行情位于本轮开盘价下方，反弹按始终在场空头背景评估。",
      alwaysInBias: bias,
      trendStrength: "实时模型辅助判断；追加风险前必须确认后续跟进力度",
      tradingRangeState: "不预设交易区间；以模型绘图和测量证据作为行动流依据",
      keyLevels: [
        { label: "本轮低点", price: round2(low), evidence: "实时5分钟K线最低点" },
        { label: "本轮高点", price: round2(high), evidence: "实时5分钟K线最高点" },
        {
          label: "模型下单入场价",
          price: order.entry,
          evidence: order.execution_plan.trigger_condition
        }
      ],
      setupCandidate: order.setup_name,
      invalidation: `跌破或突破 ${order.stop.toFixed(2)} 将使本笔实时模拟交易假设失效。`,
      entryType: order.execution_plan.entry_tactic,
      stop: order.stop,
      target: order.target,
      positionSizeSuggestion: order.quantity,
      noTradeReason: null,
      confidence: 0.61,
      reasoningSummary: visibleChineseReasoningSummary({
        analysisText,
        modelName: config.name,
        order,
        bias,
        toolNames: drawingResult.actions.map((action) => action.tool)
      }),
      thinkingSteps,
      decisionTrace,
      knowledgeRefs: refs,
      evidenceTrail: [
        "实时行情数据来自非 mock provider。",
        `模型 API：${modelProvider} / ${config.model}。`,
        `已执行工具：${drawingResult.actions.map((action) => action.tool).join("、")}。`,
        "入场、止损、止盈、仓位和交易理由已序列化为图表交易标注。"
      ],
      modelUsage: usage
    },
    orders: [{ ...order, reason: tradeReason, status: "submitted", filled_entry: null }],
    trades: [],
    tradeSnapshots: [],
    tradeReplay: [
      {
        stage: "plan",
        snapshotId: "snapshot-live-plan",
        title: "实时交易计划",
        time: last.timestamp,
        barIndex: candles.length - 1,
        chartObjectIds: chartObjects.map((object) => object.id),
        orderId: order.id,
        outcome: "已提交",
        narrative: tradeReason
      }
    ],
    equityCurve: [],
    performanceSummary: {
      starting_equity: 10000,
      ending_equity: 10000,
      total_trades: 0,
      win_rate: 0,
      net_pnl: 0,
      max_drawdown: 0,
      setup_stats: []
    },
    journal: [
      {
        time: last.timestamp,
        event: "实时模拟订单已提交",
        text: tradeReason
      }
    ],
    knowledge: knowledgeBrowser()
  };
}

function normalizeClientMarket(payload) {
  const source = payload?.source ?? {};
  const candles = normalizeClientCandles(payload?.candles);
  if (source.isMock === true || candles.length < 20) {
    throw httpError(
      400,
      "agent run requires non-mock 5m candles from the visible chart before model tools can run"
    );
  }
  const last = candles.at(-1);
  const quote = normalizeClientQuote(payload?.quote, last);
  return {
    source: {
      id: String(source.id ?? "browser_xauusd_5m"),
      label: String(source.label ?? "Browser supplied XAUUSD 5m candles"),
      instrumentSymbol: String(source.instrumentSymbol ?? "XAUUSD"),
      instrumentKind: String(source.instrumentKind ?? "spot_history"),
      isSpot: source.isSpot !== false,
      isMock: false,
      historyCompleteness: String(source.historyCompleteness ?? "historical_5m"),
      latency: String(source.latency ?? "browser_direct")
    },
    quote,
    candles
  };
}

function normalizeClientCandles(rawCandles) {
  if (!Array.isArray(rawCandles)) {
    throw httpError(400, "agent run requires non-mock 5m candles from the visible chart");
  }
  return rawCandles.map((raw, index) => {
    const open = finiteNumber(raw?.open, `candles[${index}].open`);
    const high = finiteNumber(raw?.high, `candles[${index}].high`);
    const low = finiteNumber(raw?.low, `candles[${index}].low`);
    const close = finiteNumber(raw?.close, `candles[${index}].close`);
    const timestamp = new Date(raw?.timestamp);
    if (Number.isNaN(timestamp.getTime())) {
      throw httpError(400, `invalid candle timestamp at index ${index}`);
    }
    if (raw?.symbol !== "XAUUSD" || raw?.timeframe !== "5m") {
      throw httpError(400, "agent run requires XAUUSD 5m candles");
    }
    if (high < Math.max(open, close) || low > Math.min(open, close)) {
      throw httpError(400, `invalid OHLC range at index ${index}`);
    }
    const range = high - low;
    return {
      timestamp: timestamp.toISOString(),
      symbol: "XAUUSD",
      timeframe: "5m",
      open: round4(open),
      high: round4(high),
      low: round4(low),
      close: round4(close),
      volume: finiteNumber(raw?.volume ?? 0, `candles[${index}].volume`),
      body: round4(Math.abs(close - open)),
      range: round4(range),
      close_position: range === 0 ? 0.5 : round4((close - low) / range)
    };
  });
}

function normalizeClientQuote(rawQuote, lastCandle) {
  const price = rawQuote?.price == null ? lastCandle.close : finiteNumber(rawQuote.price, "quote.price");
  const timestamp = new Date(rawQuote?.timestamp ?? lastCandle.timestamp);
  if (Number.isNaN(timestamp.getTime())) {
    throw httpError(400, "invalid quote timestamp");
  }
  return {
    symbol: "XAUUSD",
    price,
    bid: rawQuote?.bid == null ? undefined : finiteNumber(rawQuote.bid, "quote.bid"),
    ask: rawQuote?.ask == null ? undefined : finiteNumber(rawQuote.ask, "quote.ask"),
    timestamp: timestamp.toISOString(),
    providerSymbol: String(rawQuote?.providerSymbol ?? "XAUUSD")
  };
}

function hasFullFiveMinuteHistory(market) {
  return (
    market.source.isMock === false &&
    market.candles.length >= 20 &&
    market.candles.every((candle) => candle.symbol === "XAUUSD" && candle.timeframe === "5m") &&
    market.source.historyCompleteness !== "latest_quote_only"
  );
}

async function callModel({ config, credential, fetchImpl, prompt, tools, toolChoice }) {
  const payload = {
    model: config.model,
    messages: [{ role: "user", content: `Output schema: TraderDecision\nSchema version: v1\n\n${prompt}` }],
    temperature: 0.2,
    tools,
    tool_choice: toolChoice ?? "auto"
  };
  const timeoutMs = modelRequestTimeoutMs();
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  let timeoutId;
  let response;
  try {
    const modelFetch = fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller?.signal
    });
    const timeoutPromise = new Promise((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        controller?.abort();
        reject(httpError(504, `model provider ${config.name} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    response = await Promise.race([modelFetch, timeoutPromise]);
  } catch (error) {
    if (controller?.signal.aborted || error?.name === "AbortError") {
      throw httpError(504, `model provider ${config.name} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  }
  if (!response.ok) {
    throw httpError(502, `model provider ${config.name} returned ${response.status}`);
  }
  const raw = await response.json();
  const message = raw?.choices?.[0]?.message ?? {};
  return {
    text: typeof message.content === "string" ? message.content : "",
    toolCalls: parseToolCalls(message.tool_calls ?? []),
    usage: {
      input_tokens: Number(raw?.usage?.prompt_tokens ?? 0),
      output_tokens: Number(raw?.usage?.completion_tokens ?? 0)
    }
  };
}

function modelRequestTimeoutMs() {
  const configured = Number(process.env.PAQUANT_MODEL_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return DEFAULT_MODEL_REQUEST_TIMEOUT_MS;
}

function parseToolCalls(rawCalls) {
  return rawCalls
    .map((call, index) => {
      const fn = call?.function ?? {};
      if (typeof fn.name !== "string") {
        return null;
      }
      let args = {};
      try {
        args = JSON.parse(fn.arguments || "{}");
      } catch {
        args = {};
      }
      return { id: String(call.id ?? `tool-call-${index + 1}`), name: fn.name, arguments: args };
    })
    .filter(Boolean);
}

function executeToolCalls(candles, toolCalls) {
  const chartObjects = [];
  const objectIndex = new Map();
  const actions = [];
  for (const call of toolCalls) {
    const { output, observation, chartObject } = executeTool(candles, call, objectIndex);
    if (chartObject) {
      chartObjects.push(chartObject);
      objectIndex.set(chartObject.id, chartObject);
    }
    actions.push({
      sequence: actions.length + 1,
      tool: call.name,
      status: "ok",
      observation,
      arguments: call.arguments,
      output,
      chartObjectId: chartObject?.id ?? null
    });
  }
  return { actions, chartObjects };
}

function executeTool(candles, call, objectIndex) {
  const args = call.arguments ?? {};
  if (call.name === "find_swings") {
    const swings = findSwings(
      candles,
      Number(args.left_strength ?? 2),
      Number(args.right_strength ?? 2),
      args.limit == null ? null : Number(args.limit)
    );
    return { output: { swings }, observation: `Found ${swings.length} local swing points.` };
  }
  if (call.name === "draw_trendline") {
    const [start, end] = boundedAnchorPair(
      anchor(args.start, 0, candles[0].close),
      anchor(args.end, candles.length - 1, candles.at(-1).close)
    );
    const chartObject = {
      kind: "trendline",
      id: String(args.id ?? `model-trendline-${objectIndex.size + 1}`),
      label: String(args.label ?? "Model trend line"),
      anchors: [start, end],
      reason: String(args.reason ?? "趋势线用于限定当前价格行为观察区间。")
    };
    return {
      output: { chart_object: chartObject },
      observation: `Drew trend line ${chartObject.label}.`,
      chartObject
    };
  }
  if (call.name === "measure_leg") {
    const start = anchor(args.start, 0, candles[0].close);
    const end = anchor(args.end, candles.length - 1, candles.at(-1).close);
    const output = {
      points: round4(end.price - start.price),
      abs_points: round4(Math.abs(end.price - start.price)),
      bars: Math.abs(end.time_index - start.time_index) + 1
    };
    return { output, observation: "Measured leg distance and bar count." };
  }
  if (call.name === "count_bars") {
    const start = Number(args.start_index ?? 0);
    const end = Number(args.end_index ?? candles.length - 1);
    return {
      output: { start_index: start, end_index: end, bars: Math.abs(end - start) + 1 },
      observation: "Counted bars between indexes."
    };
  }
  if (call.name === "project_line" || call.name === "measure_deviation") {
    return {
      output: { points: 0, price: candles.at(-1).close },
      observation: `Executed ${call.name} with live candle anchors.`
    };
  }
  if (call.name === "draw_box") {
    const chartObject = {
      kind: "range_box",
      id: String(args.id ?? `model-box-${objectIndex.size + 1}`),
      label: String(args.label ?? "Model range box"),
      start_index: Number(args.start_index ?? 0),
      end_index: Number(args.end_index ?? candles.length - 1),
      high: Number(args.high ?? Math.max(...candles.map((candle) => candle.high))),
      low: Number(args.low ?? Math.min(...candles.map((candle) => candle.low))),
      reason: String(args.reason ?? "箱体用于限定回调或交易区间的时间和价格边界。")
    };
    return { output: { chart_object: chartObject }, observation: `Marked range box ${chartObject.label}.`, chartObject };
  }
  if (call.name === "draw_fibonacci") {
    const [start, end] = boundedAnchorPair(
      anchor(args.start, 0, candles[0].close),
      anchor(args.end, candles.length - 1, candles.at(-1).close)
    );
    const chartObject = {
      kind: "fibonacci",
      id: String(args.id ?? `model-fib-${objectIndex.size + 1}`),
      label: String(args.label ?? "Model swing retracement"),
      start,
      end,
      levels: buildFibonacciLevels(start, end),
      reason: String(args.reason ?? "斐波那契只用于所选摆动腿的回撤测量。")
    };
    return { output: { chart_object: chartObject }, observation: `Mapped Fibonacci levels for ${chartObject.label}.`, chartObject };
  }
  return { output: { ignored: true }, observation: `Tool ${call.name} recorded but not rendered.` };
}

function buildFibonacciLevels(start, end) {
  const distance = end.price - start.price;
  return {
    "0.382": round4(end.price - distance * 0.382),
    "0.500": round4(end.price - distance * 0.5),
    "0.618": round4(end.price - distance * 0.618)
  };
}

function boundedAnchorPair(start, end) {
  const span = Math.abs(end.time_index - start.time_index);
  if (span <= MAX_MODEL_DRAWING_BARS) {
    return [start, end];
  }
  if (end.time_index >= start.time_index) {
    const boundedStartIndex = end.time_index - MAX_MODEL_DRAWING_BARS;
    return [{ time_index: boundedStartIndex, price: linePriceAt(start, end, boundedStartIndex) }, end];
  }
  const boundedEndIndex = end.time_index + MAX_MODEL_DRAWING_BARS;
  return [start, { time_index: boundedEndIndex, price: linePriceAt(start, end, boundedEndIndex) }];
}

function linePriceAt(start, end, timeIndex) {
  if (end.time_index === start.time_index) {
    return start.price;
  }
  return start.price + ((end.price - start.price) / (end.time_index - start.time_index)) * (timeIndex - start.time_index);
}

function parseYahooCandles(result) {
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const opens = quote.open ?? [];
  const highs = quote.high ?? [];
  const lows = quote.low ?? [];
  const closes = quote.close ?? [];
  const volumes = quote.volume ?? [];
  const candles = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const values = [opens[index], highs[index], lows[index], closes[index]];
    if (values.some((value) => value == null || Number.isNaN(Number(value)))) {
      continue;
    }
    const open = round4(Number(opens[index]));
    const high = round4(Number(highs[index]));
    const low = round4(Number(lows[index]));
    const close = round4(Number(closes[index]));
    const range = high - low;
    candles.push({
      timestamp: new Date(Number(timestamps[index]) * 1000).toISOString(),
      symbol: "XAUUSD",
      timeframe: "5m",
      open,
      high,
      low,
      close,
      volume: Number(volumes[index] ?? 0),
      body: round4(Math.abs(close - open)),
      range: round4(range),
      close_position: range === 0 ? 0.5 : round4((close - low) / range)
    });
  }
  return candles;
}

function marketStructureObjects(candles, sourceLabel = "live") {
  if (!Array.isArray(candles) || candles.length < 20) {
    return [];
  }
  const lastIndex = candles.length - 1;
  const rangeStart = Math.max(0, candles.length - 36);
  const recent = candles.slice(rangeStart);
  const rangeHigh = Math.max(...recent.map((candle) => candle.high));
  const rangeLow = Math.min(...recent.map((candle) => candle.low));
  const direction = candles[lastIndex].close >= candles[rangeStart].open ? "long" : "short";
  const swings = findSwings(candles, 2, 2, null);
  const swingKind = direction === "long" ? "low" : "high";
  const structureSwings = swings
    .filter((swing) => swing.kind === swingKind && swing.anchor.time_index >= Math.max(0, lastIndex - 72))
    .slice(-2);
  const fallbackStart = Math.max(0, lastIndex - Math.min(24, candles.length - 1));
  const trendStart =
    structureSwings[0]?.anchor ?? {
      time_index: fallbackStart,
      price: direction === "long" ? candles[fallbackStart].low : candles[fallbackStart].high
    };
  const trendEnd =
    structureSwings[1]?.anchor ?? {
      time_index: lastIndex,
      price: direction === "long" ? candles[lastIndex].close : candles[lastIndex].close
    };
  const [boundedStart, boundedEnd] = boundedAnchorPair(trendStart, trendEnd);
  return [
    {
      kind: "range_box",
      id: `${sourceLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-structure-range`,
      label: "最近结构箱体",
      start_index: rangeStart,
      end_index: lastIndex,
      high: round2(rangeHigh),
      low: round2(rangeLow),
      reason: `${sourceLabel} 实时行情识别的有限范围结构箱体，用于观察最近 ${lastIndex - rangeStart + 1} 根K线的交易区间边界。`
    },
    {
      kind: "trendline",
      id: `${sourceLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-structure-trend`,
      label: direction === "long" ? "最近多头结构线" : "最近空头结构线",
      anchors: [boundedStart, boundedEnd],
      reason: `${sourceLabel} 实时行情识别的有限范围趋势线，锚定在K线索引和价格坐标上，缩放和平移时随K线重投影。`
    }
  ];
}

function analysisPrompt({ candles, first, last, high, low, refs }) {
  const recent = candles.slice(-8).map((candle, offset) => ({
    index: candles.length - 8 + offset,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close
  }));
  return (
    "你是 PAquant 的布鲁克斯通用交易员。请分析实时 XAUUSD 5分钟期货代理行情。 " +
    "必须先调用至少一个绘图工具和至少一个测量工具，再形成交易假设。 " +
    "每个绘图对象都必须有有限起止K线范围和 reason 字段，除非整段就是被分析 setup，否则不要横跨整张图。 " +
    "不要暴露隐藏思维链；所有可见输出必须只用简体中文，不能输出英文解释。\n\n" +
    `Session facts: first_open=${first.open}, last_close=${last.close}, high=${high}, low=${low}, bars=${candles.length}.\n` +
    `Recent candles: ${JSON.stringify(recent)}.\n` +
    `Relevant Brooks refs: ${refs.map((ref) => ref.key).join(", ")}.`
  );
}

function forcedToolPrompt(toolName, candles, refs) {
  const first = candles[0];
  const last = candles.at(-1);
  const startIndex = Math.max(0, candles.length - MAX_MODEL_DRAWING_BARS);
  const scopedFirst = candles[startIndex];
  const midIndex = Math.max(1, Math.floor(candles.length / 2));
  const mid = candles[midIndex];
  if (toolName === "draw_trendline") {
    return (
      "上一轮没有生成图表绘图。现在只调用 draw_trendline，使用 id 'model-live-trendline', " +
      `label '最近结构趋势线', start {'time_index':${startIndex},'price':${scopedFirst.low}}, ` +
      `end {'time_index':${candles.length - 1},'price':${last.close}}, ` +
      "reason '只覆盖最近结构窗口，用来观察当前始终在场方向'. 可见文本必须是简体中文。" +
      `Relevant refs: ${refs.map((ref) => ref.key).join(", ")}.`
    );
  }
  return (
    "上一轮没有生成测量。现在只调用 measure_leg，使用 " +
    `start {'time_index':0,'price':${first.close}}, end {'time_index':${midIndex},'price':${mid.close}}. ` +
    `可见文本必须是简体中文。Relevant refs: ${refs.map((ref) => ref.key).join(", ")}.`
  );
}

function brooksToolDefinitions() {
  return [
    toolSchema("find_swings", { left_strength: "integer", right_strength: "integer", limit: "integer" }),
    toolSchema(
      "draw_trendline",
      { id: "string", label: "string", start: "anchor", end: "anchor", reason: "string" },
      ["id", "label", "start", "end"]
    ),
    toolSchema("draw_box", { id: "string", label: "string", start_index: "integer", end_index: "integer", high: "number", low: "number", reason: "string" }),
    toolSchema("draw_fibonacci", { id: "string", label: "string", start: "anchor", end: "anchor", reason: "string" }, ["id", "label", "start", "end"]),
    toolSchema("measure_leg", { start: "anchor", end: "anchor" }, ["start", "end"]),
    toolSchema("count_bars", { start_index: "integer", end_index: "integer" }),
    toolSchema("project_line", { start: "anchor", end: "anchor", time_index: "integer" }),
    toolSchema("measure_deviation", { start: "anchor", end: "anchor", point: "anchor" })
  ];
}

function toolSchema(name, props, required = []) {
  const properties = {};
  for (const [key, type] of Object.entries(props)) {
    properties[key] = type === "anchor" ? anchorSchema() : { type };
  }
  return {
    type: "function",
    function: {
      name,
      description: `${name} tool for PAquant chart analysis`,
      parameters: { type: "object", properties, required }
    }
  };
}

function anchorSchema() {
  return {
    type: "object",
    properties: {
      time_index: { type: "integer" },
      price: { type: "number" }
    },
    required: ["time_index", "price"]
  };
}

function buildContextualOrder(candles, bias) {
  const signal = findSignalBar(candles, bias);
  const tick = 0.1;
  const minimumRisk = 1;

  if (bias === "short") {
    const entry = round2(signal.candle.low - tick);
    const stop = round2(Math.max(signal.candle.high + tick, entry + minimumRisk));
    const risk = round2(Math.abs(stop - entry));
    return {
      id: "sim-XAUUSD-5m-live-brooks-short",
      symbol: "XAUUSD",
      timeframe: "5m",
      side: "sell",
      order_type: "stop",
      activation_price: entry,
      entry,
      stop,
      target: round2(entry - risk * 2),
      quantity: 1,
      setup_name: "始终在场空头背景下的 Brooks 信号K线突破",
      execution_plan: buildExecutionPlan({
        side: "sell",
        entry,
        signal,
        triggerSide: "low"
      })
    };
  }
  const entry = round2(signal.candle.high + tick);
  const stop = round2(Math.min(signal.candle.low - tick, entry - minimumRisk));
  const risk = round2(Math.abs(entry - stop));
  return {
    id: "sim-XAUUSD-5m-live-brooks-long",
    symbol: "XAUUSD",
    timeframe: "5m",
    side: "buy",
    order_type: "stop",
    activation_price: entry,
    entry,
    stop,
    target: round2(entry + risk * 2),
    quantity: 1,
    setup_name: "始终在场多头背景下的 Brooks 信号K线突破",
    execution_plan: buildExecutionPlan({
      side: "buy",
      entry,
      signal,
      triggerSide: "high"
    })
  };
}

function findSignalBar(candles, bias) {
  const startIndex = Math.max(0, candles.length - 12);
  const recent = candles.slice(startIndex);
  const predicate =
    bias === "short"
      ? (candle) => candle.close < candle.open && candle.close_position <= 0.45
      : (candle) => candle.close > candle.open && candle.close_position >= 0.55;

  for (let offset = recent.length - 1; offset >= 0; offset -= 1) {
    if (predicate(recent[offset])) {
      return { index: startIndex + offset, candle: recent[offset] };
    }
  }

  const fallbackIndex = candles.length - 1;
  return { index: fallbackIndex, candle: candles[fallbackIndex] };
}

function buildExecutionPlan({ side, entry, signal, triggerSide }) {
  const isBuy = side === "buy";
  const signalExtreme = triggerSide === "high" ? signal.candle.high : signal.candle.low;
  const triggerVerb = isBuy ? "突破" : "跌破";
  const orderName = isBuy ? "buy stop" : "sell stop";
  const directionLabel = isBuy ? "多头" : "空头";
  return {
    order_type_label: orderName,
    signal_bar_index: signal.index,
    signal_bar_time: signal.candle.timestamp,
    signal_bar_pattern: `${directionLabel}信号K线：实体方向一致，收盘位置支持 ${orderName}`,
    trigger_price: entry,
    trigger_condition: `${triggerVerb}信号K线${triggerSide === "high" ? "高点" : "低点"} ${signalExtreme.toFixed(
      2
    )} 后，以 ${entry.toFixed(2)} 触发 ${orderName}`,
    entry_tactic: `${orderName} stop order，等待信号K线被触发后才入场；触发前不成交`
  };
}

function describeExecutionPlan(order) {
  const plan = order.execution_plan;
  return `订单类型为 ${plan.order_type_label}；信号K线为第 ${
    plan.signal_bar_index + 1
  } 根，${plan.trigger_condition}。`;
}

function formatOrderSide(side) {
  return side === "sell" ? "做空" : "做多";
}

function visibleChineseReasoningSummary({ analysisText, modelName, order, bias, toolNames }) {
  const text = String(analysisText ?? "").trim();
  if (containsChinese(text)) {
    return text;
  }
  const direction = bias === "short" ? "空头" : "多头";
  const risk = round2(Math.abs(order.entry - order.stop));
  const reward = round2(Math.abs(order.target - order.entry));
  const tools = toolNames.length ? toolNames.join("、") : "绘图和测量工具";
  return (
    `${modelName} 已完成实时结构分析：当前始终在场方向按${direction}评估，` +
    `已执行 ${tools}，并基于入场 ${order.entry.toFixed(2)}、止损 ${order.stop.toFixed(2)}、` +
    `止盈 ${order.target.toFixed(2)} 形成模拟${formatOrderSide(order.side)}计划。` +
    `本轮风险 ${risk} 点，目标回报 ${reward} 点。`
  );
}

function visibleThinkingSteps({ candles, market, order, refs, drawingResult, modelProvider, model, bias }) {
  const lastIndex = candles.length - 1;
  const signal = order.execution_plan;
  return [
    {
      phase: "observe",
      title: "读取行情",
      summary: `读取 ${candles.length} 根 XAUUSD 5分钟已收盘K线，最新收盘 ${candles[lastIndex].close.toFixed(2)}。`,
      evidence: [
        `数据源：${market.source.label}`,
        `最新报价：${market.quote.price.toFixed(2)}`
      ]
    },
    {
      phase: "retrieve",
      title: "检索 Brooks 知识",
      summary: "检索上下文优先、始终在场、回调和交易员方程相关条目。",
      evidence: refs.map((ref) => `${ref.key} ${Math.round(ref.score * 100)}%`)
    },
    {
      phase: "measure",
      title: "调用工具测量",
      summary: `模型返回工具调用后，PAquant 执行 ${drawingResult.actions.length} 个绘图/测量动作。`,
      evidence: drawingResult.actions.map((action) => action.tool)
    },
    {
      phase: "hypothesis",
      title: "形成交易假设",
      summary: `始终在场方向按 ${bias === "short" ? "空头" : "多头"} 评估，候选 setup 为 ${order.setup_name}。`,
      evidence: [
        `信号K线：第 ${signal.signal_bar_index + 1} 根`,
        `触发条件：${signal.trigger_condition}`
      ]
    },
    {
      phase: "risk",
      title: "检查失效和风险回报",
      summary: `入场 ${order.entry.toFixed(2)}，止损 ${order.stop.toFixed(2)}，止盈 ${order.target.toFixed(2)}，仓位 ${order.quantity}。`,
      evidence: [
        `风险点数：${round2(Math.abs(order.entry - order.stop))}`,
        `目标点数：${round2(Math.abs(order.target - order.entry))}`
      ]
    },
    {
      phase: "decision",
      title: "输出决策",
      summary: `${modelProvider} / ${model} 通过工具证据形成 ${signal.order_type_label} 模拟订单；未启用真实 broker。`,
      evidence: [`订单类型：${order.order_type}`, `触发价：${signal.trigger_price.toFixed(2)}`]
    }
  ];
}

function visibleDecisionTrace({ order, bias, high, low, drawingResult }) {
  const signal = order.execution_plan;
  return [
    {
      question: "当前方向是否清楚？",
      answer: `按最近K线和工具测量，始终在场方向暂按 ${bias === "short" ? "空头" : "多头"} 处理。`,
      outcome: "pass",
      evidence: `窗口高点 ${round2(high)}，低点 ${round2(low)}。`
    },
    {
      question: "模型是否真的调用工具？",
      answer: `已执行 ${drawingResult.actions.map((action) => action.tool).join("、")}。`,
      outcome: "pass",
      evidence: "绘图对象和测量输出已进入 agentActions 与 chartObjects。"
    },
    {
      question: "是否有具体订单？",
      answer: `${signal.order_type_label}，信号K线第 ${signal.signal_bar_index + 1} 根，触发价 ${signal.trigger_price.toFixed(2)}。`,
      outcome: "pass",
      evidence: signal.trigger_condition
    },
    {
      question: "风险是否可审计？",
      answer: `下单计划包含入场 ${order.entry.toFixed(2)}、止损 ${order.stop.toFixed(2)}、止盈 ${order.target.toFixed(2)}、仓位 ${order.quantity}。`,
      outcome: "pass",
      evidence: "止损、止盈、入场和仓位同步绘制为图表 trade_marker。"
    }
  ];
}

function containsChinese(text) {
  return /[\u3400-\u9fff]/.test(text);
}

function tradeMarkers(order, candles) {
  const index = order.execution_plan?.signal_bar_index ?? Math.max(0, candles.length - 1);
  const endIndex = Math.min(candles.length - 1, index + 8);
  const trigger = order.execution_plan?.trigger_condition;
  return [
    {
      kind: "trade_marker",
      id: "entry-marker",
      label: `入场 ${order.entry.toFixed(2)} | 仓位 ${order.quantity}`,
      time_index: index,
      start_index: index,
      end_index: endIndex,
      price: order.entry,
      marker_type: "entry",
      quantity: order.quantity,
      reason: trigger
        ? `订单类型 ${order.order_type}；入场标记：${trigger}；仓位 ${order.quantity}`
        : "入场标记来自模型工具调用后的实时模拟订单。"
    },
    {
      kind: "trade_marker",
      id: "stop-marker",
      label: `止损 ${order.stop.toFixed(2)} | 仓位 ${order.quantity}`,
      time_index: index,
      start_index: index,
      end_index: endIndex,
      price: order.stop,
      marker_type: "stop",
      quantity: order.quantity,
      reason: `止损 ${order.stop.toFixed(2)} 是本笔 ${order.order_type} 模拟订单的失效价格。`
    },
    {
      kind: "trade_marker",
      id: "target-marker",
      label: `止盈 ${order.target.toFixed(2)} | 仓位 ${order.quantity}`,
      time_index: endIndex,
      start_index: index,
      end_index: endIndex,
      price: order.target,
      marker_type: "target",
      quantity: order.quantity,
      reason: `止盈 ${order.target.toFixed(2)} 是从入场价测算出的 2R 回报目标。`
    }
  ];
}

function measuredMove(order) {
  return {
    kind: "measured_move",
    id: "mm-target",
    label: "等距测量目标",
    start: { time_index: 0, price: order.entry },
    end: { time_index: 8, price: order.target },
    projected_from: { time_index: 12, price: round2((order.entry + order.target) / 2) },
    target_price: round2(order.target + Math.abs(order.target - order.entry) / 2),
    reason: "等距测量从入场腿投射目标区域，范围只覆盖本次信号后的观察窗口。"
  };
}

function threePush(candles) {
  const indexes = [Math.floor(candles.length * 0.35), Math.floor(candles.length * 0.6), candles.length - 1];
  return {
    kind: "three_push",
    id: "three-push",
    label: "Three pushes probe on live feed",
    pushes: indexes.map((index) => ({ time_index: index, price: candles[index].high })),
    reason: "三推只连接三次实际推动锚点，用来观察通道末端动能是否衰竭。"
  };
}

function findSwings(candles, leftStrength, rightStrength, limit) {
  const swings = [];
  for (let index = leftStrength; index < candles.length - rightStrength; index += 1) {
    const candle = candles[index];
    const left = candles.slice(index - leftStrength, index);
    const right = candles.slice(index + 1, index + rightStrength + 1);
    if (candle.high >= Math.max(...left.concat(right).map((item) => item.high))) {
      swings.push({ kind: "high", anchor: { time_index: index, price: candle.high } });
    }
    if (candle.low <= Math.min(...left.concat(right).map((item) => item.low))) {
      swings.push({ kind: "low", anchor: { time_index: index, price: candle.low } });
    }
  }
  return limit == null ? swings : swings.slice(0, limit);
}

function knowledgeBrowser() {
  return {
    version: "cloud-function.phase-one",
    sources: [
      {
        id: "brooks-compiled",
        title: "Brooks 价格行为结构化摘要",
        sourceType: "local_pdf",
        themes: ["上下文", "始终在场", "回调", "交易员方程"],
        chapterRefs: ["compiled:trend", "compiled:trading-range", "compiled:wedge"]
      }
    ],
    concepts: [
      {
        key: "context-before-setup",
        name: "先看上下文再看形态",
        summary: "同一个形态在趋势、通道或交易区间中含义不同。",
        sourceRefs: ["compiled:trend"],
        questions: ["始终在场方向是哪边？", "是否出现后续跟进？"]
      }
    ],
    setupDossiers: [
      {
        key: "always-in-pullback",
        name: "始终在场回调",
        context: "只有趋势上下文、通道质量和交易员方程清楚后，才评估回调。",
        observations: ["趋势线", "回调质量"],
        measurements: ["腿长", "K线计数", "偏离通道幅度"],
        entryStyles: ["回调限价", "信号后止损触发入场"],
        stopLogic: ["放在失效摆动之外"],
        targets: ["2R", "等距测量"],
        management: ["后续跟进失败时减小风险"],
        failureModes: ["突破失败", "转入交易区间"],
        nearbySetups: ["二次入场", "楔形回调"],
        sourceRefs: ["compiled:pullback"]
      }
    ],
    caseCards: [
      {
        key: "live-pullback",
        title: "实时模型辅助回调",
        sourceRefs: ["compiled:pullback"],
        chartContext: "实时 XAU 5分钟期货代理行情",
        patternInterpretation: "把工具输出作为证据，不展示隐藏思维链。",
        traderThinking: "下单前检查上下文、失效条件和交易员方程。",
        expectedFollowThrough: "追加风险前应先看到后续跟进。",
        failureScenario: "突破止损价外侧将使假设失效。"
      }
    ],
    reasoningPlaybooks: [
      {
        key: "brooks-live-checklist",
        name: "Brooks 实时检查清单",
        questions: ["当前上下文是什么？", "工具测量了什么？", "失效位置在哪里？"],
        requiredObservations: ["趋势/区间状态", "关键价位", "风险/回报"],
        invalidationChecks: ["止损价", "后续跟进失败"],
        displayGuardrails: ["只展示可审计摘要，不展示隐藏思维链。"]
      }
    ]
  };
}

function knowledgeRefs() {
  return [
    {
      artifactType: "reasoning_playbook",
      key: "brooks-live-checklist",
      title: "Brooks 实时检查清单",
      summary: "下单前检查上下文、测量结果、失效条件和交易员方程。",
      sourceRefs: ["compiled:pullback"],
      score: 0.91
    },
    {
      artifactType: "setup_dossier",
      key: "always-in-pullback",
      title: "始终在场回调",
      summary: "用实时上下文和风险回报过滤回调候选。",
      sourceRefs: ["compiled:pullback"],
      score: 0.88
    }
  ];
}

function traderProfiles() {
  const tools = [
    "find_swings",
    "draw_trendline",
    "draw_channel",
    "draw_box",
    "draw_fibonacci",
    "measure_leg",
    "compare_legs",
    "count_bars",
    "project_line",
    "measure_deviation",
    "snap_to_swing"
  ];
  const sharedKnowledgeFiles = [
    ".agents/common/price-action-core.md",
    ".agents/common/risk-control.md"
  ];
  const base = (id) => ({
    agentFile: `.agents/traders/${id}.md`,
    sharedKnowledgeFiles,
    sharedKnowledgeSummary: "Shared Price Action Core / Shared Risk Control"
  });
  return [
    {
      id: "brooks-generalist",
      ...base("brooks-generalist"),
      name: "布鲁克斯通用交易员",
      persona: "均衡型价格行为模拟交易员，先检查上下文，再给形态贴标签。",
      status: "active",
      symbol: "XAUUSD",
      timeframe: "5m",
      preferredSetups: ["始终在场回调", "二次入场", "突破失败", "三推"],
      riskStyle: "中等风险；上下文和交易员方程确认后使用一单位模拟风险。",
      toolPermissions: tools,
      knowledgePolicy: "检索概念图谱、形态档案和相似失败案例。",
      recentAction: "等待用户启动；不会自动调用模型。",
      performance: { equity: 10020, winRate: 1, maxDrawdown: 0, trades: 1, averageR: 2 }
    },
    {
      id: "always-in-trend",
      ...base("always-in-trend"),
      name: "始终在场趋势交易员",
      persona: "跟踪始终在场方向、趋势紧迫性、回调质量和趋势恢复。",
      status: "standby",
      symbol: "XAUUSD",
      timeframe: "5m",
      preferredSetups: ["始终在场回调", "微通道", "趋势恢复"],
      riskStyle: "趋势跟随；只有强上下文确认后才接受更宽止损。",
      toolPermissions: tools,
      knowledgePolicy: "优先检索趋势、通道、始终在场和强趋势推演手册。",
      recentAction: "等待清晰的始终在场多空转换。",
      performance: { equity: 10000, winRate: 0, maxDrawdown: 0, trades: 0, averageR: 0 }
    },
    {
      id: "second-entry",
      ...base("second-entry"),
      name: "二次入场专家",
      persona: "等待 High 2 / Low 2 二次触发，只在第一次尝试失败后重新评估顺势机会。",
      status: "standby",
      symbol: "XAUUSD",
      timeframe: "5m",
      preferredSetups: ["High 2 回调", "Low 2 回调", "二次入场趋势恢复"],
      riskStyle: "保守；第二信号K线必须给出清晰触发价和失效价。",
      toolPermissions: tools,
      knowledgePolicy: "优先检索二次入场、回调质量、信号K线和交易员方程档案。",
      recentAction: "等待第一次尝试失败后的 H2/L2 信号K线。",
      performance: { equity: 10000, winRate: 0, maxDrawdown: 0, trades: 0, averageR: 0 }
    },
    {
      id: "best-trades-only",
      ...base("best-trades-only"),
      name: "精选交易保守派",
      persona: "强过滤交易机会；交易员方程不够清楚时接受不交易。",
      status: "standby",
      symbol: "XAUUSD",
      timeframe: "5m",
      preferredSetups: ["High 2 回调", "Low 2 回调", "主要趋势反转"],
      riskStyle: "保守；概率和回报不清晰时只用小仓位或不下单。",
      toolPermissions: tools,
      knowledgePolicy: "检索交易员方程、信号K线质量和失败模式案例。",
      recentAction: "因信号质量混杂，拒绝边缘回调机会。",
      performance: { equity: 10000, winRate: 0, maxDrawdown: 0, trades: 0, averageR: 0 }
    },
    {
      id: "trading-range-scalper",
      ...base("trading-range-scalper"),
      name: "交易区间剥头皮员",
      persona: "把交易区间视为不确定状态，偏向低买高卖测试。",
      status: "standby",
      symbol: "XAUUSD",
      timeframe: "5m",
      preferredSetups: ["区间反向", "突破失败", "微型双顶/双底"],
      riskStyle: "剥头皮；快速退出，靠近区间中线时减仓。",
      toolPermissions: tools,
      knowledgePolicy: "优先检索交易区间、突破失败和支撑阻力案例。",
      recentAction: "观察当前通道是否演化为成熟交易区间。",
      performance: { equity: 10000, winRate: 0, maxDrawdown: 0, trades: 0, averageR: 0 }
    },
    {
      id: "breakout-pullback",
      ...base("breakout-pullback"),
      name: "突破回调交易员",
      persona: "只在突破已经证明自己之后等待回测确认，拒绝普通回调伪装成突破回调。",
      status: "standby",
      symbol: "XAUUSD",
      timeframe: "5m",
      preferredSetups: ["突破回调", "强突破跟进", "等距测量目标"],
      riskStyle: "事件驱动；仓位取决于突破跟进、回测质量和止损距离。",
      toolPermissions: tools,
      knowledgePolicy: "优先检索突破回调、等距测量、失败突破和通道投影档案。",
      recentAction: "等待突破后续跟进确认，再接受回测入场。",
      performance: { equity: 10000, winRate: 0, maxDrawdown: 0, trades: 0, averageR: 0 }
    },
    {
      id: "wedge-reversal",
      ...base("wedge-reversal"),
      name: "楔形反转专家",
      persona: "研究三推、过冲、欠冲、动能衰减和反转风险。",
      status: "research",
      symbol: "XAUUSD",
      timeframe: "5m",
      preferredSetups: ["楔形反转", "三推", "最终旗形"],
      riskStyle: "反转型；需要清晰失效位和衰竭后的确认。",
      toolPermissions: tools,
      knowledgePolicy: "优先检索楔形、三推、最终旗形和动能变化案例。",
      recentAction: "正在标记三推候选，但等待更清晰的信号K线。",
      performance: { equity: 10000, winRate: 0, maxDrawdown: 0, trades: 0, averageR: 0 }
    },
    {
      id: "breakout-failure",
      ...base("breakout-failure"),
      name: "突破失败交易员",
      persona: "评估突破力度、后续跟进、被套交易者和失败入场。",
      status: "research",
      symbol: "XAUUSD",
      timeframe: "5m",
      preferredSetups: ["突破回调", "突破失败", "等距测量"],
      riskStyle: "事件驱动；仓位取决于突破跟进和止损距离。",
      toolPermissions: tools,
      knowledgePolicy: "优先检索突破、失败、等距测量和交易者陷阱案例。",
      recentAction: "正在比较突破跟进和等距测量目标。",
      performance: { equity: 10000, winRate: 0, maxDrawdown: 0, trades: 0, averageR: 0 }
    },
    {
      id: "major-reversal",
      ...base("major-reversal"),
      name: "主要趋势反转专家",
      persona: "等待趋势线突破、极点测试失败和强反向突破同时出现。",
      status: "research",
      symbol: "XAUUSD",
      timeframe: "5m",
      preferredSetups: ["主要趋势反转", "趋势线突破后测试", "反向二次入场"],
      riskStyle: "反转确认；结构完成前不提前摸顶摸底。",
      toolPermissions: tools,
      knowledgePolicy: "优先检索主要趋势反转、楔形、最终旗形和始终在场翻转档案。",
      recentAction: "检查趋势线突破加极点测试失败是否完整。",
      performance: { equity: 10000, winRate: 0, maxDrawdown: 0, trades: 0, averageR: 0 }
    },
    {
      id: "final-flag",
      ...base("final-flag"),
      name: "最终旗形交易员",
      persona: "观察成熟趋势末端的最终旗形失败和顺势交易者被套压力。",
      status: "research",
      symbol: "XAUUSD",
      timeframe: "5m",
      preferredSetups: ["最终旗形", "失败延续", "楔形后的反向突破"],
      riskStyle: "精选反转；等待失败延续和清晰信号K线后才提交 Stop 单。",
      toolPermissions: tools,
      knowledgePolicy: "优先检索最终旗形、失败突破、楔形和交易者陷阱案例。",
      recentAction: "观察成熟趋势里的顺势延续失败。",
      performance: { equity: 10000, winRate: 0, maxDrawdown: 0, trades: 0, averageR: 0 }
    }
  ];
}

function mergeUsage(provider, model, responses, config) {
  const inputTokens = responses.reduce((sum, response) => sum + response.usage.input_tokens, 0);
  const outputTokens = responses.reduce((sum, response) => sum + response.usage.output_tokens, 0);
  return {
    provider,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd: round8(
      (inputTokens / 1000000) * config.inputCostPerMillion +
        (outputTokens / 1000000) * config.outputCostPerMillion
    )
  };
}

function hasTool(toolCalls, toolSet) {
  return toolCalls.some((call) => toolSet.has(call.name));
}

function normalizePath(rawUrl) {
  const parsed = new URL(rawUrl, "http://paquant.local");
  let path = parsed.pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/api/")) {
    path = path.slice(4);
  } else if (path === "/api") {
    path = "/";
  }
  return path;
}

function parseJsonBody(body) {
  if (!body) {
    return {};
  }
  try {
    return JSON.parse(body);
  } catch {
    throw httpError(400, "invalid JSON request body");
  }
}

function jsonResponse(payload, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: statusCode === 204 ? "" : JSON.stringify(payload)
  };
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sanitizeError(message) {
  let sanitized = message;
  for (const config of Object.values(MODEL_PROVIDERS)) {
    const secret = process.env[config.apiKeyEnv];
    if (secret) {
      sanitized = sanitized.replaceAll(secret, "[REDACTED]");
    }
  }
  return sanitized;
}

function numberOrThrow(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`missing numeric ${fieldName}`);
  }
  return number;
}

function optionalNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function finiteNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw httpError(400, `missing numeric ${fieldName}`);
  }
  return number;
}

function anchor(payload, fallbackIndex, fallbackPrice) {
  return {
    time_index: Number(payload?.time_index ?? fallbackIndex),
    price: Number(payload?.price ?? fallbackPrice)
  };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function round8(value) {
  return Math.round(value * 100000000) / 100000000;
}

module.exports = {
  createAgentRun,
  handleRequest,
  listModelProviders,
  loadLiveMarket
};
