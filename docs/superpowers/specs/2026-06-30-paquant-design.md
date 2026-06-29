# PAquant Pre-Development Design

Status: planning approved, implementation not started
Date: 2026-06-30
Repository: gry1024/PAquant
CloudBase env: groy-env-d5g7okht7dcd202fe
CloudBase service name: paquant

## 1. Product Vision

PAquant means Price Action Quant. The product is an AI-native price action trading system inspired by Al Brooks' price action framework. The final product should feel like a TradingView-class web application, but built around AI traders instead of manual human charting.

The user opens a web dashboard, chooses an AI trader, and watches that trader analyze a live or replayed XAU 5-minute chart. The trader draws trend lines, channels, boxes, three-push structures, measured moves, and other annotations through precise tool commands. The user can inspect the trader's observations, measurement results, trade plan, simulated orders, trade journal, replay, win rate, equity curve, and performance by setup.

The first implementation stage does not connect live trading. It must build the core non-broker product well: Brooks knowledge compilation, AI-native chart workbench, tool-based drawing and measurement, a single simulated AI trader, local persistence, and a deployable web frontend.

## 2. Confirmed Decisions

- Project name: PAquant.
- GitHub repo: public repository `gry1024/PAquant`.
- Frontend deployment target: CloudBase, environment `groy-env-d5g7okht7dcd202fe`.
- CloudBase frontend service name: `paquant`.
- First UI target: desktop web only.
- First traded/replayed market: XAU, 5-minute chart as the primary decision timeframe.
- Higher timeframes such as M15 and H1 are auxiliary context only.
- First phase skips live trading and broker execution.
- Final broker target remains Exness MT5 Standard Cent for XAUUSDc, then possible later expansion to STARTRADER.
- Development must use an isolated virtual environment before coding. Prefer `uv` for Python; use `conda` only if heavyweight local model or CUDA dependencies require it.
- First persistence target: local SQLite or local Postgres. Default: SQLite for the first loop, with schema designed to migrate to Postgres.
- Model cost limit: no hard daily budget. The system should still track usage and cost telemetry.
- Model provider priority for cheap testing: DeepSeek, Qwen, MiniMax, then Kimi for long-context tasks.
- Public repo must not commit `.env.local` or raw local secrets.
- Compiled Brooks knowledge artifacts can be committed. Raw source PDFs should stay local and ignored.

## 3. Product Layers

### 3.1 Web Frontend: AI-Native TradingView

The frontend is the primary product surface. It should be a dense professional trading workstation rather than a marketing page.

Core views:

- Market workbench: XAU 5-minute chart with AI annotations.
- AI trader list: multiple trader personas, status, recent action, equity curve, win rate, drawdown.
- Trader detail: live/replay chart, action stream, trade journal, setup stats, open simulated position.
- Trade replay: pre-entry chart, AI drawings, plan, execution, outcome, post-trade review.
- Knowledge browser: compiled Brooks concepts, setup dossiers, examples, and source mappings.

The UI should reference TradingView's information density and clarity, while adding AI-native panels for trader actions, plans, and review. It should not be a generic card-heavy dashboard.

### 3.2 Chart Workbench and Drawing Engine

The chart is not just pixels. It is an object world shared by humans and AI traders.

Core chart objects:

- Candles with OHLC, timestamp, body ratio, tails, close position, range, and spread metadata.
- Swing highs/lows.
- Legs and pullbacks.
- Trend lines and trend channel lines.
- Channels and micro channels.
- Boxes/trading ranges.
- Three-push and wedge structures.
- Measured moves.
- Fibonacci anchors and levels.
- Orders, stops, targets, and filled trades.

The AI trader uses tool commands rather than freehand drawing:

- `find_swings`
- `draw_trendline`
- `draw_channel`
- `draw_box`
- `draw_fibonacci`
- `measure_leg`
- `compare_legs`
- `count_bars`
- `project_line`
- `measure_deviation`
- `snap_to_swing`

The important design point: tools do not decide whether a trade is good. They provide precise measurements. The AI trader decides the market meaning.

### 3.3 Brooks Knowledge Compilation Layer

The three local Al Brooks books are source material for building a trading cognition system, not a few keyword cards.

The compiler should produce:

- Chapter map and source catalog.
- Concept graph: trend, trading range, breakout, pullback, reversal, always-in, trader's equation, signal bar, entry bar, failure, final flag, wedge, three pushes.
- Setup dossiers: context, observations, measurements, entry styles, stop logic, targets, management, failure modes, similar/nearby setups.
- Case cards: source reference, chart context, pattern interpretation, what traders are thinking, expected follow-through, failure scenario.
- Reasoning playbooks: questions an AI trader asks before trading.

The compiled knowledge should preserve depth. For example, "three pushes" is not a label. It requires context, push count, leg quality, spacing, channel relation, overshoot or undershoot, signal bar quality, momentum change, and expected correction behavior.

Raw book text should not be dumped into the repo. The committed knowledge should be original structured summaries, mappings, and metadata produced by the compiler.

### 3.4 AI Trader Ability Layer

An AI trader is not just a prompt. It is a configured agent with:

- Persona and trading style.
- Preferred setups.
- Risk style for simulation.
- Analysis loop.
- Tool permissions.
- Knowledge retrieval policy.
- Output schema.
- Journal format.

Initial trader: Brooks Generalist Simulator.

Future traders:

- Always-In Trend Trader.
- Best-Trades-Only Conservative Trader.
- Trading Range Scalper.
- Wedge/Reversal Specialist.
- Breakout and Failed Breakout Trader.

The AI trader loop:

1. Observe the chart.
2. Retrieve relevant Brooks knowledge and prior cases.
3. Identify market state: trend, channel, trading range, transition, uncertainty.
4. Draw and measure what is needed.
5. Re-observe the annotated chart.
6. Form a trade thesis.
7. Challenge the thesis with failure scenarios.
8. Produce a structured simulated trade plan or no-trade decision.
9. Track outcome and write review.

The frontend should display the trader's auditable workflow: observations, drawings, measurements, thesis, invalidation, plan, and review. It should not expose or depend on raw hidden model chain-of-thought.

### 3.5 Simulation Engine

The first phase uses simulated trading only.

Simulation requirements:

- Market, limit, stop, stop-limit style simulated orders.
- Entry, stop loss, take profit, cancel, modify.
- Slippage and spread model.
- Position sizing model.
- R-multiple accounting.
- MFE/MAE tracking.
- Equity curve and drawdown.
- Per-setup performance stats.

The simulator should be deterministic against historical candle data so tests can replay a trading session and get the same results.

### 3.6 Data Layer

First phase data should be acquired by the project, not supplied manually by the user.

Recommended order:

1. Historical XAU 5-minute data from a reliable export source such as Dukascopy for replay and simulation.
2. Later MT5 read-only data from Exness for broker-specific symbol behavior.
3. Later real-time broker or market data adapters.

The data model should normalize provider-specific symbols into internal instruments.

Example:

- Internal: `XAUUSD`
- Exness Standard Cent MT5 later: likely `XAUUSDc`

### 3.7 Persistence Layer

First phase default: local SQLite.

Tables/entities:

- instruments
- candles
- sessions
- chart_objects
- ai_traders
- agent_runs
- agent_actions
- simulated_orders
- simulated_trades
- trade_reviews
- knowledge_sources
- knowledge_chunks
- setup_dossiers
- model_calls

Schema should be relational and portable to Postgres/Supabase/CloudBase RDB later.

### 3.8 Model Provider Layer

The model provider must be swappable.

Initial providers:

- DeepSeek: cheap text reasoning, logs, review, routine analysis.
- Qwen/DashScope: cheap and likely useful for multimodal/vision experiments.
- MiniMax: additional low-cost provider for testing.
- Kimi/Moonshot: long-context knowledge tasks when needed.
- OpenAI: optional future high-quality multimodal baseline if a key is provided.

Provider adapter responsibilities:

- Unified request interface.
- Model capability metadata: text, vision, structured output, tool calling, context length.
- Cost telemetry.
- Retry/fallback.
- Redaction of secrets from logs.
- Prompt and output schema versioning.

No hard budget cap is required, but usage should still be recorded.

### 3.9 Broker Adapter Layer

Live trading is not part of phase one, but the boundary must exist.

Future live flow:

- Strategy/agent proposes trade.
- Risk engine validates.
- Broker adapter translates order.
- MT5 executor submits order.
- Execution events are written back to the journal.

The final live target remains Exness MT5 Standard Cent on XAUUSDc. Live code must never be mixed into the AI reasoning layer.

## 4. Brooks Trading Taste Extracted So Far

The system should be built around these principles:

- Context before setup. The same pattern can mean opposite things in a trend, channel, or trading range.
- The market is always moving between agreement and breakout attempts.
- Every bar is both a tiny trading range and a possible signal bar.
- Strong trends create urgency and often deny clean pullbacks.
- Channels are two-sided and often behave like sloping trading ranges.
- Trading ranges are uncertainty; buy low, sell high, and expect many breakouts to fail.
- Always-in direction is a way to stay synchronized with the current swing.
- Failure is information. Failed setups often create better opposite trades.
- A trade is justified by trader's equation: probability, risk, and reward.
- Wedges and three-push patterns are not geometry tricks. They express repeated attempts, momentum change, trader exhaustion, and potential correction.

## 5. Deployment Direction

### 5.1 First Phase Recommendation

Use CloudBase for the web deployment and keep AI/backend simulation local.

Reasons:

- CloudBase MCP is already authenticated and bound to the target environment.
- CloudBase `manageApps` can deploy the web app to an independent subdomain.
- Local backend is better for PDF compilation, model experiments, historical data ingestion, and fast iteration.
- SQLite keeps the first loop simple.

### 5.2 Alternative: Vercel + Supabase

Vercel + Supabase remains a strong long-term option:

- Vercel is excellent for GitHub preview deployments and AI Gateway.
- Supabase is excellent for Postgres, Realtime, Storage, vectors, and open-source SaaS patterns.

The first phase should not require it. We can design interfaces so CloudBase/SQLite can migrate to Vercel/Supabase later.

## 6. Development Environment

Before writing application code:

1. Create a Python virtual environment with `uv`.
2. Create a frontend workspace with Node and pnpm.
3. Keep `.env.local` local-only.
4. Commit `.env.example` with placeholders.
5. Add tests before or alongside implementation.

Expected local commands later:

```bash
uv venv
uv pip install -r requirements.txt
pnpm install
```

Exact commands may change once the final project scaffold is selected.

## 7. Testing and Acceptance

Each module needs tests.

Minimum test categories:

- Knowledge compiler unit tests.
- PDF source catalog and chapter extraction tests.
- Chart object serialization tests.
- Drawing and measurement geometry tests.
- Swing/leg detection tests.
- Simulation engine deterministic replay tests.
- Model provider adapter tests with mocked providers.
- Agent action schema tests.
- Frontend component tests.
- Playwright visual checks for the chart workbench.
- Secret scanning before committing.

Acceptance for phase one:

- The local app can load XAU 5-minute historical data.
- The web workbench displays the chart.
- The AI trader can issue structured drawing/measurement commands.
- The system records the drawing objects and shows them on the chart.
- The AI trader can produce simulated trade/no-trade decisions.
- The simulator records orders, trades, R multiples, equity curve, and reviews.
- The frontend deploys to CloudBase.
- Tests pass.

## 8. Security and Git Hygiene

- `.env.local` is ignored.
- API keys must never be logged or committed.
- Public repo should include `.env.example`, docs, source code, tests, and compiled knowledge artifacts.
- Raw local PDFs and temporary extraction files are ignored.
- Generated knowledge should be reviewed for size and usefulness before committing.

## 9. Remaining Design Questions

These should be resolved before full implementation:

1. Frontend chart library: KLineCharts, TradingView Lightweight Charts, or custom canvas layer.
   - Current recommendation: KLineCharts for MVP because overlays and trading-style drawing are first-class.
2. First persistence target: SQLite only or local Postgres from day one.
   - Current recommendation: SQLite first, portable schema.
3. First AI trader persona.
   - Current recommendation: Brooks Generalist Simulator.
4. First data source implementation.
   - Current recommendation: implement a historical XAU data downloader/importer first, then add MT5 read-only later.
5. Frontend auth.
   - Current recommendation: no auth in local MVP; CloudBase deployment can be public preview initially unless user wants private access.
6. Knowledge compilation depth.
   - Current recommendation: first compile chapter/source map and concept graph, then build setup dossiers iteratively.
7. Whether to enable CloudBase database in phase one.
   - Current recommendation: not initially; sync/export later.

## 10. Non-Goals for Phase One

- No live trading.
- No MT5 order execution.
- No mobile-first UI.
- No full TradingView clone.
- No raw PDF upload to public git.
- No hidden unmanaged model spending logic.
- No tightly coupled monolith.
