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
    candles
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
  const tradeReason =
    `Real ${config.name} API returned tool calls; PAquant executed drawing and measurement tools. ` +
    `The simulated ${order.side} order uses ${round2(Math.abs(order.entry - order.stop))} points risk and ` +
    `${round2(Math.abs(order.target - order.entry))} points reward.`;

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
          ? "Live XAU 5m futures proxy is trading above the session open; pullbacks are evaluated in an always-in long context."
          : "Live XAU 5m futures proxy is trading below the session open; rallies are evaluated in an always-in short context.",
      alwaysInBias: bias,
      trendStrength: "live model-assisted context; verify follow-through before adding risk",
      tradingRangeState: "not assumed; model drawing and measurement evidence is shown in the action stream",
      keyLevels: [
        { label: "session low", price: round2(low), evidence: "Lowest live 5m candle" },
        { label: "session high", price: round2(high), evidence: "Highest live 5m candle" },
        {
          label: "model order entry",
          price: order.entry,
          evidence: "Entry is derived from live visible pullback structure"
        }
      ],
      setupCandidate: order.setup_name,
      invalidation: `A break through ${order.stop.toFixed(2)} invalidates the live simulated trade thesis.`,
      entryType: `limit ${order.side}`,
      stop: order.stop,
      target: order.target,
      positionSizeSuggestion: order.quantity,
      noTradeReason: null,
      confidence: 0.61,
      reasoningSummary:
        analysisText ||
        "Model API returned required tool calls; PAquant executed them before placing the simulated order.",
      knowledgeRefs: refs,
      evidenceTrail: [
        "Live market data loaded from a non-mock provider.",
        `Model API: ${modelProvider} / ${config.model}.`,
        `Executed tools: ${drawingResult.actions.map((action) => action.tool).join(", ")}.`,
        "Entry, stop, target, quantity, and reason are serialized as chart trade markers."
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
        title: "Live plan",
        time: last.timestamp,
        barIndex: candles.length - 1,
        chartObjectIds: chartObjects.map((object) => object.id),
        orderId: order.id,
        outcome: "submitted",
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
        event: "Live simulated order submitted",
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
  const response = await fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credential}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
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
    const chartObject = {
      kind: "trendline",
      id: String(args.id ?? `model-trendline-${objectIndex.size + 1}`),
      label: String(args.label ?? "Model trend line"),
      anchors: [anchor(args.start, 0, candles[0].close), anchor(args.end, candles.length - 1, candles.at(-1).close)]
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
      low: Number(args.low ?? Math.min(...candles.map((candle) => candle.low)))
    };
    return { output: { chart_object: chartObject }, observation: `Marked range box ${chartObject.label}.`, chartObject };
  }
  return { output: { ignored: true }, observation: `Tool ${call.name} recorded but not rendered.` };
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

function analysisPrompt({ candles, first, last, high, low, refs }) {
  const recent = candles.slice(-8).map((candle, offset) => ({
    index: candles.length - 8 + offset,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close
  }));
  return (
    "You are PAquant Brooks Generalist. Analyze live XAUUSD 5m futures-proxy data as a price-action trader. " +
    "You must call at least one drawing tool and at least one measurement tool before finalizing the thesis. " +
    "Do not expose hidden chain-of-thought; return a concise reasoning summary after tool calls.\n\n" +
    `Session facts: first_open=${first.open}, last_close=${last.close}, high=${high}, low=${low}, bars=${candles.length}.\n` +
    `Recent candles: ${JSON.stringify(recent)}.\n` +
    `Relevant Brooks refs: ${refs.map((ref) => ref.key).join(", ")}.`
  );
}

function forcedToolPrompt(toolName, candles, refs) {
  const first = candles[0];
  const last = candles.at(-1);
  const midIndex = Math.max(1, Math.floor(candles.length / 2));
  const mid = candles[midIndex];
  if (toolName === "draw_trendline") {
    return (
      "Your previous response did not create a chart drawing. Call draw_trendline now using id 'model-live-trendline', " +
      `label 'Model live trend line', start {'time_index':0,'price':${first.low}}, ` +
      `end {'time_index':${candles.length - 1},'price':${last.close}}. Relevant refs: ${refs.map((ref) => ref.key).join(", ")}.`
    );
  }
  return (
    "Your previous response did not create a measurement. Call measure_leg now using " +
    `start {'time_index':0,'price':${first.close}}, end {'time_index':${midIndex},'price':${mid.close}}. ` +
    `Relevant refs: ${refs.map((ref) => ref.key).join(", ")}.`
  );
}

function brooksToolDefinitions() {
  return [
    toolSchema("find_swings", { left_strength: "integer", right_strength: "integer", limit: "integer" }),
    toolSchema("draw_trendline", { id: "string", label: "string", start: "anchor", end: "anchor" }, ["id", "label", "start", "end"]),
    toolSchema("draw_box", { id: "string", label: "string", start_index: "integer", end_index: "integer", high: "number", low: "number" }),
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
  const early = candles.slice(0, Math.min(13, candles.length));
  const sessionHigh = Math.max(...candles.map((candle) => candle.high));
  const sessionLow = Math.min(...candles.map((candle) => candle.low));
  const earlyHigh = Math.max(...early.map((candle) => candle.high));
  const earlyLow = Math.min(...early.map((candle) => candle.low));
  const risk = round2(Math.min(5, Math.max(1, (sessionHigh - sessionLow) * 0.12)));
  if (bias === "short") {
    const entry = round2(earlyHigh - Math.min(3.5, Math.max(1, risk * 0.7)));
    return {
      id: "sim-XAUUSD-5m-live-brooks-short",
      symbol: "XAUUSD",
      timeframe: "5m",
      side: "sell",
      order_type: "limit",
      activation_price: null,
      entry,
      stop: round2(entry + risk),
      target: round2(entry - risk * 2),
      quantity: 1,
      setup_name: "Brooks pullback in always-in short context"
    };
  }
  const entry = round2(earlyLow + Math.min(3.5, Math.max(1, risk * 0.7)));
  return {
    id: "sim-XAUUSD-5m-live-brooks-long",
    symbol: "XAUUSD",
    timeframe: "5m",
    side: "buy",
    order_type: "limit",
    activation_price: null,
    entry,
    stop: round2(entry - risk),
    target: round2(entry + risk * 2),
    quantity: 1,
    setup_name: "Brooks pullback in always-in long context"
  };
}

function tradeMarkers(order, candles) {
  const index = Math.max(0, candles.length - 1);
  return [
    {
      kind: "trade_marker",
      id: "entry-marker",
      label: `Entry ${order.entry.toFixed(2)} | Size ${order.quantity}`,
      time_index: index,
      price: order.entry,
      marker_type: "entry",
      quantity: order.quantity,
      reason: "Entry marks the live simulated order generated after model tool calls."
    },
    {
      kind: "trade_marker",
      id: "stop-marker",
      label: `Stop ${order.stop.toFixed(2)} | Size ${order.quantity}`,
      time_index: index,
      price: order.stop,
      marker_type: "stop",
      quantity: order.quantity,
      reason: "Stop marks the invalidation price for this live simulated order."
    },
    {
      kind: "trade_marker",
      id: "target-marker",
      label: `Target ${order.target.toFixed(2)} | Size ${order.quantity}`,
      time_index: index,
      price: order.target,
      marker_type: "target",
      quantity: order.quantity,
      reason: "Target marks the 2R measured reward from the order entry."
    }
  ];
}

function measuredMove(order) {
  return {
    kind: "measured_move",
    id: "mm-target",
    label: "Measured move target",
    start: { time_index: 0, price: order.entry },
    end: { time_index: 8, price: order.target },
    projected_from: { time_index: 12, price: round2((order.entry + order.target) / 2) },
    target_price: round2(order.target + Math.abs(order.target - order.entry) / 2)
  };
}

function threePush(candles) {
  const indexes = [Math.floor(candles.length * 0.35), Math.floor(candles.length * 0.6), candles.length - 1];
  return {
    kind: "three_push",
    id: "three-push",
    label: "Three pushes probe on live feed",
    pushes: indexes.map((index) => ({ time_index: index, price: candles[index].high }))
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
        title: "Compiled Brooks price action summaries",
        sourceType: "local_pdf",
        themes: ["context", "always-in", "pullback", "trader equation"],
        chapterRefs: ["compiled:trend", "compiled:trading-range", "compiled:wedge"]
      }
    ],
    concepts: [
      {
        key: "context-before-setup",
        name: "Context before setup",
        summary: "The same pattern has different meaning in trend, channel, or range.",
        sourceRefs: ["compiled:trend"],
        questions: ["What is the always-in side?", "Is follow-through present?"]
      }
    ],
    setupDossiers: [
      {
        key: "always-in-pullback",
        name: "Always-in pullback",
        context: "Evaluate pullbacks only after trend context, channel quality, and trader equation are visible.",
        observations: ["trend line", "pullback quality"],
        measurements: ["leg distance", "bar count", "deviation from channel"],
        entryStyles: ["limit pullback", "stop entry after signal"],
        stopLogic: ["beyond invalidation swing"],
        targets: ["2R", "measured move"],
        management: ["reduce when follow-through fails"],
        failureModes: ["failed breakout", "range transition"],
        nearbySetups: ["second entry", "wedge pullback"],
        sourceRefs: ["compiled:pullback"]
      }
    ],
    caseCards: [
      {
        key: "live-pullback",
        title: "Live model-assisted pullback",
        sourceRefs: ["compiled:pullback"],
        chartContext: "Live XAU 5m futures proxy",
        patternInterpretation: "Treat tool output as evidence, not as hidden reasoning.",
        traderThinking: "Check context, invalidation, and trader equation before order.",
        expectedFollowThrough: "Follow-through should appear before adding risk.",
        failureScenario: "Break beyond stop invalidates thesis."
      }
    ],
    reasoningPlaybooks: [
      {
        key: "brooks-live-checklist",
        name: "Brooks live checklist",
        questions: ["What is the context?", "What did tools measure?", "Where is invalidation?"],
        requiredObservations: ["trend/range state", "key levels", "risk/reward"],
        invalidationChecks: ["stop price", "failed follow-through"],
        displayGuardrails: ["Show auditable summary, not hidden chain-of-thought."]
      }
    ]
  };
}

function knowledgeRefs() {
  return [
    {
      artifactType: "reasoning_playbook",
      key: "brooks-live-checklist",
      title: "Brooks live checklist",
      summary: "Context, measurements, invalidation, and trader equation before order.",
      sourceRefs: ["compiled:pullback"],
      score: 0.91
    },
    {
      artifactType: "setup_dossier",
      key: "always-in-pullback",
      title: "Always-in pullback",
      summary: "Pullback candidate filtered by live context and risk/reward.",
      sourceRefs: ["compiled:pullback"],
      score: 0.88
    }
  ];
}

function traderProfiles() {
  return [
    {
      id: "brooks-generalist",
      name: "Brooks Generalist",
      persona: "Live model-backed price-action simulator that calls tools before placing simulated orders.",
      status: "active",
      symbol: "XAUUSD",
      timeframe: "5m",
      preferredSetups: ["always-in pullback", "failed breakout", "three pushes"],
      riskStyle: "one unit simulated risk after visible invalidation",
      toolPermissions: ["find_swings", "draw_trendline", "measure_leg", "count_bars"],
      knowledgePolicy: "retrieve compiled Brooks checklist and setup dossier",
      recentAction: "Waiting for user start; no model call runs automatically.",
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
