# PAquant Phase One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable, tested PAquant phase-one vertical slice: XAU 5m replay data, Brooks knowledge artifacts, structured drawing objects, a mockable Brooks Generalist AI trader, deterministic simulated trading, audit persistence, and a TradingView-like web workstation ready for CloudBase preview.

**Architecture:** Use a small monorepo with a Python domain/service layer and a React/Vite frontend. Keep domain modules decoupled by folder boundary: `knowledge_layer`, `data_layer`, `drawing_engine`, `simulation_engine`, `model_provider`, `agent_runtime`, `audit_replay`, and future-only `broker_adapter`. The frontend consumes typed fixture/state payloads and renders a professional desktop-first workstation with chart, drawing overlays, AI analysis, orders, journal, and performance panels.

**Tech Stack:** Python 3.11+ with `uv`, `pytest`, `pydantic`, SQLite; React 19, TypeScript, Vite, Vitest, Testing Library, Playwright, `lightweight-charts`, `lucide-react`; package management with `pnpm`; CloudBase frontend deployment service `paquant`.

## Global Constraints

- Repository: public GitHub repo `gry1024/PAquant`.
- CloudBase environment: `groy-env-d5g7okht7dcd202fe`.
- CloudBase service name: `paquant`.
- Phase one is Web only, desktop-first, and must not fully break mobile layout.
- Core market is XAU only.
- Core timeframe is 5m only; M15/H1 are auxiliary context only.
- Phase one must not connect live broker execution or submit real orders.
- Future live target is Exness MT5 Standard Cent `XAUUSDc`.
- Use an isolated development environment before coding: `uv` for Python and `pnpm` for frontend packages.
- Never print, commit, or expose `.env.local`, real API keys, broker credentials, or raw secrets.
- Do not commit raw source PDFs, videos, or temporary extraction files.
- `.env.local`, raw教材目录, PDFs, and `tmp/` must remain ignored.
- Compiled Brooks knowledge artifacts may be committed if they are structured summaries and metadata, not raw book dumps.
- Default persistence is local SQLite with schema boundaries portable to Postgres/Supabase/CloudBase RDB.
- Model provider priority is `deepseek,qwen,minimax,kimi`; provider calls must be mockable.
- Record model usage/cost telemetry; no hard daily budget cap in phase one.
- Frontend must feel like a professional trading workstation, not a marketing site or generic card dashboard.
- Tests are required for each core module; screenshots are not the only validation.
- Do not mix data ingestion, chart rendering, AI reasoning, persistence, and simulation in one large file.

---

## File Structure

Create or modify these files:

- `pyproject.toml`: Python project metadata, dependencies, pytest/ruff settings, and local package discovery.
- `services/api/paquant/__init__.py`: package marker.
- `services/api/paquant/data_layer/schemas.py`: `Candle`, `Instrument`, `Timeframe`, and candle validation.
- `services/api/paquant/data_layer/sample_data.py`: deterministic XAU 5m sample data loader.
- `services/api/paquant/data_layer/replay.py`: `ReplaySession` cursor over candles.
- `services/api/paquant/knowledge_layer/compiler.py`: source catalog and minimal compiled Brooks concept graph.
- `services/api/paquant/knowledge_layer/artifacts/brooks_core.json`: committed structured knowledge artifact.
- `services/api/paquant/drawing_engine/schemas.py`: serializable chart object schemas.
- `services/api/paquant/drawing_engine/geometry.py`: trendline, box, fibonacci, measured move, and three-push geometry helpers.
- `services/api/paquant/simulation_engine/orders.py`: order, fill, trade, risk, and equity types.
- `services/api/paquant/simulation_engine/engine.py`: deterministic simulated order matching.
- `services/api/paquant/audit_replay/schema.py`: SQLite DDL boundaries for phase-one entities.
- `services/api/paquant/audit_replay/repository.py`: small repository methods used by tests and agent runtime.
- `services/api/paquant/model_provider/base.py`: provider protocol, request/response types, usage telemetry.
- `services/api/paquant/model_provider/mock.py`: deterministic mock provider for tests.
- `services/api/paquant/agent_runtime/brooks_generalist.py`: Brooks Generalist Simulator loop and structured decision output.
- `services/api/paquant/broker_adapter/base.py`: future broker interface and mock-safe boundary.
- `services/api/paquant/export_fixture.py`: builds frontend fixture JSON from backend modules.
- `services/api/tests/**`: pytest coverage for every backend module.
- `package.json`: root scripts for `dev`, `build`, `test`, `lint`, and `typecheck`.
- `pnpm-workspace.yaml`: workspace package list.
- `apps/web/package.json`: frontend dependencies and scripts.
- `apps/web/index.html`: Vite entry.
- `apps/web/src/main.tsx`: React bootstrap.
- `apps/web/src/App.tsx`: workstation layout composition.
- `apps/web/src/components/*.tsx`: chart, tool rail, panels, tabs, metrics, and journal components.
- `apps/web/src/lib/*.ts`: fixture loading, chart transforms, and typed UI models.
- `apps/web/src/styles.css`: dense light trading workstation theme.
- `apps/web/src/fixtures/paquant-demo.json`: committed demo payload exported from backend.
- `apps/web/src/**/*.test.tsx`: component and transform tests.
- `apps/web/tests/workbench.spec.ts`: Playwright smoke and layout test.
- `cloudbaserc.json`: CloudBase app target metadata for static frontend deployment.
- `.env.example`: placeholders only; no real secrets.
- `README.md`: update with local commands and current phase-one status.

---

## Task 0: Repo Safety and Isolated Environment

**Files:**
- Modify: `.gitignore`
- Modify: `.env.example`
- Create: `.python-version`

**Interfaces:**
- Consumes: existing public-safe repo with ignored `.env.local`, `tmp/`, raw PDFs, and `教材和视频/`.
- Produces: a reproducible local environment contract for all later tasks.

- [ ] **Step 1: Verify git and ignore state**

Run:

```powershell
git status --short --branch
git check-ignore -v -- '.env.local' 'tmp/' 'tmp' '*.pdf'
```

Expected: clean branch output and ignore matches for `.env.local`, `tmp`, and `*.pdf`.

- [ ] **Step 2: Pin Python version marker**

Create `.python-version` with:

```text
3.11
```

- [ ] **Step 3: Create uv virtual environment**

Run:

```powershell
uv venv
```

Expected: `.venv/` is created and remains ignored by `.gitignore`.

- [ ] **Step 4: Commit environment safety metadata**

Run:

```powershell
git add .gitignore .env.example .python-version
git diff --cached --check
git commit -m "chore: confirm PAquant environment safety"
```

Commit only if there are actual staged changes.

---

## Task 1: Monorepo Scaffold and Scripts

**Files:**
- Create: `pyproject.toml`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/vitest.setup.ts`
- Create: `apps/web/playwright.config.ts`
- Create: `services/api/paquant/__init__.py`

**Interfaces:**
- Produces root commands:
  - `uv run pytest`
  - `pnpm test`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm build`
  - `pnpm dev`

- [ ] **Step 1: Write scaffold files**

`pyproject.toml` must expose package `paquant` from `services/api` and include:

```toml
[project]
name = "paquant"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["pydantic>=2.8", "typing-extensions>=4.12"]

[dependency-groups]
dev = ["pytest>=8.2", "ruff>=0.5"]

[tool.pytest.ini_options]
testpaths = ["services/api/tests"]
pythonpath = ["services/api"]
```

Root `package.json` must provide:

```json
{
  "scripts": {
    "dev": "pnpm --filter @paquant/web dev",
    "build": "pnpm --filter @paquant/web build",
    "test": "pnpm --filter @paquant/web test",
    "lint": "pnpm --filter @paquant/web lint",
    "typecheck": "pnpm --filter @paquant/web typecheck"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```powershell
uv sync --all-groups
pnpm install
```

Expected: `uv.lock` and `pnpm-lock.yaml` are created.

- [ ] **Step 3: Verify empty scaffold**

Run:

```powershell
uv run pytest
pnpm typecheck
pnpm build
```

Expected: pytest exits successfully with either collected tests or a controlled bootstrap test; frontend typecheck and build pass.

- [ ] **Step 4: Commit scaffold**

Run:

```powershell
git add pyproject.toml uv.lock package.json pnpm-workspace.yaml pnpm-lock.yaml apps services
git diff --cached --check
git commit -m "chore: scaffold PAquant monorepo"
```

---

## Task 2: XAU 5m Data Layer

**Files:**
- Create: `services/api/paquant/data_layer/schemas.py`
- Create: `services/api/paquant/data_layer/sample_data.py`
- Create: `services/api/paquant/data_layer/replay.py`
- Create: `services/api/tests/data_layer/test_sample_data.py`
- Create: `services/api/tests/data_layer/test_replay.py`

**Interfaces:**
- Produces: `Candle`, `load_sample_candles() -> list[Candle]`, `ReplaySession.next(count: int) -> list[Candle]`.
- Consumes: no external market data or user-supplied files in the first slice.

- [ ] **Step 1: Write failing candle validation test**

Test high/low invariants:

```python
import pytest
from pydantic import ValidationError
from paquant.data_layer.schemas import Candle

def test_candle_rejects_invalid_high_low():
    with pytest.raises(ValidationError):
        Candle(timestamp="2026-06-30T00:00:00Z", symbol="XAUUSD", timeframe="5m", open=2300, high=2290, low=2310, close=2305, volume=100)
```

- [ ] **Step 2: Implement candle schemas**

Create `Candle` with fields `timestamp`, `symbol`, `timeframe`, `open`, `high`, `low`, `close`, `volume`, plus computed helpers `body`, `range`, and `close_position`.

- [ ] **Step 3: Add deterministic XAU sample data**

`load_sample_candles()` returns at least 48 XAUUSD 5m candles generated from fixed values, not random data.

- [ ] **Step 4: Add replay tests and implementation**

`ReplaySession.next(10)` returns the next 10 candles, advances the cursor, and returns fewer candles at the end without raising.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
uv run pytest services/api/tests/data_layer -v
git add services/api/paquant/data_layer services/api/tests/data_layer
git commit -m "feat: add XAU 5m replay data layer"
```

---

## Task 3: Brooks Knowledge Compilation Layer

**Files:**
- Create: `services/api/paquant/knowledge_layer/compiler.py`
- Create: `services/api/paquant/knowledge_layer/artifacts/brooks_core.json`
- Create: `services/api/tests/knowledge_layer/test_compiler.py`

**Interfaces:**
- Produces: `compile_core_knowledge() -> KnowledgeArtifact`.
- Produces artifact concepts: `context`, `always_in`, `trend_channel`, `trading_range`, `three_push`, `wedge`, `failed_breakout`, `traders_equation`.
- Consumes: source metadata only from ignored raw PDFs; does not commit raw book text.

- [ ] **Step 1: Write failing artifact coverage test**

```python
from paquant.knowledge_layer.compiler import compile_core_knowledge

def test_core_knowledge_contains_brooks_taste():
    artifact = compile_core_knowledge()
    keys = {concept.key for concept in artifact.concepts}
    assert {"context", "always_in", "three_push", "traders_equation"} <= keys
    assert all(source.title and source.source_type == "local_pdf" for source in artifact.sources)
```

- [ ] **Step 2: Implement typed compiler output**

Define `KnowledgeSource`, `Concept`, `SetupDossier`, and `KnowledgeArtifact` pydantic models. Keep summaries original and concise.

- [ ] **Step 3: Commit structured artifact**

Write `brooks_core.json` from `compile_core_knowledge().model_dump(mode="json")`. The artifact must include source titles and chapter/theme references but no raw PDF text.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
uv run pytest services/api/tests/knowledge_layer -v
git add services/api/paquant/knowledge_layer services/api/tests/knowledge_layer
git commit -m "feat: add Brooks knowledge artifact"
```

---

## Task 4: Drawing Engine and Chart Object Model

**Files:**
- Create: `services/api/paquant/drawing_engine/schemas.py`
- Create: `services/api/paquant/drawing_engine/geometry.py`
- Create: `services/api/tests/drawing_engine/test_geometry.py`
- Create: `services/api/tests/drawing_engine/test_serialization.py`

**Interfaces:**
- Produces: `ChartObject`, `AnchorPoint`, `TrendLine`, `Channel`, `RangeBox`, `Fibonacci`, `MeasuredMove`, `ThreePush`, `TradeMarker`.
- Produces geometry helpers: `line_value_at()`, `measure_leg()`, `build_fibonacci_levels()`, `serialize_chart_object()`, `deserialize_chart_object()`.
- Consumes: `Candle` from data layer.

- [ ] **Step 1: Write failing serialization test**

```python
from paquant.drawing_engine.schemas import AnchorPoint, TrendLine, deserialize_chart_object

def test_trendline_round_trips():
    obj = TrendLine(id="tl-1", label="bull trend line", anchors=[AnchorPoint(time_index=0, price=2300), AnchorPoint(time_index=10, price=2320)])
    restored = deserialize_chart_object(obj.model_dump(mode="json"))
    assert restored == obj
```

- [ ] **Step 2: Implement chart object schemas**

Use discriminated pydantic models with a `kind` field so frontend and audit replay can deserialize without guessing.

- [ ] **Step 3: Write and satisfy geometry tests**

Test trendline interpolation, leg measurement in points and bars, fibonacci level calculation, and three-push push count.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
uv run pytest services/api/tests/drawing_engine -v
git add services/api/paquant/drawing_engine services/api/tests/drawing_engine
git commit -m "feat: add structured drawing engine"
```

---

## Task 5: Simulation Engine and Audit Persistence

**Files:**
- Create: `services/api/paquant/simulation_engine/orders.py`
- Create: `services/api/paquant/simulation_engine/engine.py`
- Create: `services/api/paquant/audit_replay/schema.py`
- Create: `services/api/paquant/audit_replay/repository.py`
- Create: `services/api/tests/simulation_engine/test_engine.py`
- Create: `services/api/tests/audit_replay/test_repository.py`

**Interfaces:**
- Produces: `SimulatedOrder`, `SimulatedTrade`, `SimulationEngine.submit_order()`, `SimulationEngine.on_candle()`.
- Produces: `create_schema(connection)`, `AuditRepository.record_analysis_run()`, `record_drawing_object()`, `record_order()`, `record_trade()`, `record_model_call()`.
- Consumes: `Candle` and drawing object JSON.

- [ ] **Step 1: Write deterministic fill test**

```python
from paquant.data_layer.sample_data import load_sample_candles
from paquant.simulation_engine.engine import SimulationEngine
from paquant.simulation_engine.orders import OrderSide, OrderType, SimulatedOrder

def test_limit_order_fills_and_records_r_multiple():
    candles = load_sample_candles()
    engine = SimulationEngine(starting_equity=10_000)
    order = SimulatedOrder.limit_buy(symbol="XAUUSD", timeframe="5m", entry=2310, stop=2305, target=2320, quantity=1, setup_name="pullback")
    engine.submit_order(order)
    for candle in candles:
        engine.on_candle(candle)
    assert engine.trades
    assert engine.trades[0].risk_points == 5
```

- [ ] **Step 2: Implement order lifecycle**

Support submitted, filled, canceled, stopped, target-hit, and closed states. Keep matching deterministic: candle low touches buy limit, candle high touches sell target, candle low touches buy stop.

- [ ] **Step 3: Write SQLite schema test**

Assert tables exist: `candles`, `trader_profiles`, `analysis_runs`, `drawing_objects`, `orders`, `trades`, `trade_snapshots`, `llm_usage`, `journals`.

- [ ] **Step 4: Implement repository methods**

Use parameterized SQL only. Store structured chart objects and analysis payloads as JSON text.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
uv run pytest services/api/tests/simulation_engine services/api/tests/audit_replay -v
git add services/api/paquant/simulation_engine services/api/paquant/audit_replay services/api/tests/simulation_engine services/api/tests/audit_replay
git commit -m "feat: add simulation and audit persistence"
```

---

## Task 6: Model Provider and Brooks Generalist Agent Runtime

**Files:**
- Create: `services/api/paquant/model_provider/base.py`
- Create: `services/api/paquant/model_provider/mock.py`
- Create: `services/api/paquant/agent_runtime/brooks_generalist.py`
- Create: `services/api/paquant/broker_adapter/base.py`
- Create: `services/api/tests/model_provider/test_mock.py`
- Create: `services/api/tests/agent_runtime/test_brooks_generalist.py`
- Create: `services/api/tests/broker_adapter/test_boundary.py`

**Interfaces:**
- Produces: `ModelProvider.generate(request: ModelRequest) -> ModelResponse`.
- Produces: `ModelUsage` with provider, model, input tokens, output tokens, and estimated cost.
- Produces: `BrooksGeneralistTrader.analyze(candles, knowledge, chart_objects) -> TraderDecision`.
- Produces: `BrokerAdapter` protocol with `place_order`, `cancel_order`, `modify_order`, `get_positions`, `get_account`, `get_symbol_info`.
- Consumes: data, knowledge, drawing, simulation schemas.

- [ ] **Step 1: Write mock provider test**

```python
from paquant.model_provider.mock import MockModelProvider
from paquant.model_provider.base import ModelRequest

def test_mock_provider_returns_usage_without_secret_logging():
    provider = MockModelProvider()
    response = provider.generate(ModelRequest(prompt="Analyze XAU", schema_name="TraderDecision"))
    assert response.usage.provider == "mock"
    assert "api" not in response.text.lower()
```

- [ ] **Step 2: Implement provider base and mock**

Keep provider inputs serializable and testable. Do not read `.env.local` in tests.

- [ ] **Step 3: Write agent decision test**

Use sample candles and `compile_core_knowledge()` to assert the trader returns `market_context`, `always_in_bias`, `key_levels`, `invalidation`, `confidence`, and either a trade plan or no-trade reason.

- [ ] **Step 4: Implement Brooks Generalist v1**

The first version may use deterministic rules plus mock provider text, but all output must validate through a typed `TraderDecision` schema.

- [ ] **Step 5: Commit model and agent boundary**

Run:

```powershell
uv run pytest services/api/tests/model_provider services/api/tests/agent_runtime services/api/tests/broker_adapter -v
git add services/api/paquant/model_provider services/api/paquant/agent_runtime services/api/paquant/broker_adapter services/api/tests/model_provider services/api/tests/agent_runtime services/api/tests/broker_adapter
git commit -m "feat: add Brooks generalist agent runtime"
```

---

## Task 7: Frontend Demo Fixture Export

**Files:**
- Create: `services/api/paquant/export_fixture.py`
- Create: `services/api/tests/test_export_fixture.py`
- Create: `apps/web/src/fixtures/paquant-demo.json`

**Interfaces:**
- Produces: `build_demo_fixture() -> dict` with keys `candles`, `chartObjects`, `analysis`, `orders`, `trades`, `equityCurve`, `journal`, `knowledge`.
- Consumes: all backend phase-one modules.

- [ ] **Step 1: Write fixture shape test**

```python
from paquant.export_fixture import build_demo_fixture

def test_demo_fixture_contains_workbench_payload():
    payload = build_demo_fixture()
    assert {"candles", "chartObjects", "analysis", "orders", "trades", "equityCurve", "journal", "knowledge"} <= set(payload)
    assert payload["candles"][0]["symbol"] == "XAUUSD"
```

- [ ] **Step 2: Implement fixture builder**

Build the payload by loading sample candles, compiling knowledge, creating deterministic chart objects, running Brooks Generalist, and simulating one trade or no-trade review.

- [ ] **Step 3: Export JSON**

Run:

```powershell
uv run python -m paquant.export_fixture apps/web/src/fixtures/paquant-demo.json
```

- [ ] **Step 4: Verify and commit**

Run:

```powershell
uv run pytest services/api/tests/test_export_fixture.py -v
git add services/api/paquant/export_fixture.py services/api/tests/test_export_fixture.py apps/web/src/fixtures/paquant-demo.json
git commit -m "feat: export PAquant workbench fixture"
```

---

## Task 8: AI-Native TradingView Frontend Workstation

**Files:**
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/lib/workbenchTypes.ts`
- Create: `apps/web/src/lib/chartTransforms.ts`
- Create: `apps/web/src/components/Workbench.tsx`
- Create: `apps/web/src/components/ChartPanel.tsx`
- Create: `apps/web/src/components/DrawingOverlay.tsx`
- Create: `apps/web/src/components/TraderPanel.tsx`
- Create: `apps/web/src/components/OrdersPanel.tsx`
- Create: `apps/web/src/components/JournalPanel.tsx`
- Create: `apps/web/src/components/PerformanceStrip.tsx`
- Create: `apps/web/src/styles.css`
- Create: `apps/web/src/App.test.tsx`
- Create: `apps/web/src/lib/chartTransforms.test.ts`
- Create: `apps/web/tests/workbench.spec.ts`

**Interfaces:**
- Consumes: `apps/web/src/fixtures/paquant-demo.json`.
- Produces: desktop-first workbench with central XAU 5m chart, drawing overlays, AI action stream, orders, journal, stats, and equity curve.

- [ ] **Step 1: Write frontend fixture type and transform tests**

Test candle conversion to `lightweight-charts` format and drawing overlay coordinate normalization.

- [ ] **Step 2: Build layout shell**

Implement a full-screen app: left symbol/trader rail, top market toolbar, central chart, right AI trader panel, bottom tabs for orders/journal/performance. Do not create a marketing landing page.

- [ ] **Step 3: Implement chart and overlay**

Use `lightweight-charts` for candles and an SVG overlay for structured chart objects. Render trendlines, boxes, fibonacci levels, measured moves, three-push labels, and trade markers from JSON.

- [ ] **Step 4: Implement AI, order, journal, and performance panels**

Display auditable observations, measurements, thesis, invalidation, plan/no-trade reason, simulated orders, trade outcome, R multiple, win rate, and equity curve. Do not display hidden chain-of-thought.

- [ ] **Step 5: Add component and Playwright smoke tests**

Assert XAUUSD, Brooks Generalist, chart canvas, AI analysis, and simulated orders render.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
pnpm test
pnpm typecheck
pnpm build
git add apps/web package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat: build PAquant trading workstation"
```

---

## Task 9: Final Verification, GitHub Push, and CloudBase Preview

**Files:**
- Create: `cloudbaserc.json`
- Modify: `README.md`

**Interfaces:**
- Produces: documented local run commands, verification results, pushed branch/commits, and CloudBase preview URL when deployment tooling is authenticated.

- [ ] **Step 1: Document local commands**

Update README with:

```text
uv sync --all-groups
uv run pytest
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
uv run pytest
pnpm test
pnpm typecheck
pnpm build
git diff --check
git status --short
git diff -- . ':(exclude).env.local'
```

Expected: tests/build pass, whitespace check passes, and no secrets appear in tracked diff.

- [ ] **Step 3: Run local browser verification**

Run:

```powershell
pnpm dev
pnpm --filter @paquant/web test:e2e
```

Expected: Playwright opens the local app, confirms workstation elements render, and stores any screenshot only under ignored `test-results/` or `playwright-report/`.

- [ ] **Step 4: Commit final docs/config**

Run:

```powershell
git add README.md cloudbaserc.json docs/superpowers/plans/2026-06-30-paquant-phase-one.md
git commit -m "docs: add PAquant phase one execution plan"
```

- [ ] **Step 5: Push GitHub branch**

Run:

```powershell
git push origin HEAD
```

Expected: push succeeds to the active branch. If branch protection rejects direct push to `main`, create `codex/paquant-phase-one` and push that branch.

- [ ] **Step 6: Deploy CloudBase frontend preview**

Use authenticated CloudBase tooling or MCP to deploy `apps/web/dist` to environment `groy-env-d5g7okht7dcd202fe` service `paquant`.

Expected: final output includes the public preview URL. If CloudBase tooling is unavailable, record the exact blocker and leave `apps/web/dist` build-ready.

---

## Self-Review

- Spec coverage: the plan covers repo safety, monorepo scaffold, Brooks knowledge, XAU 5m data, drawing/chart object model, simulation, SQLite audit persistence, model provider boundary, Brooks Generalist AI trader, frontend workstation, testing, GitHub push, and CloudBase preview.
- Scope: phase one is broad, so implementation should prioritize the runnable vertical slice described in the goal while preserving stage boundaries for later expansion.
- Placeholder scan: the plan contains no `TBD` or unspecified test commands.
- Type consistency: backend payload names use `candles`, `chartObjects`, `analysis`, `orders`, `trades`, `equityCurve`, `journal`, and `knowledge` consistently across export and frontend tasks.
