# PAquant Simulation Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the phase-one simulator from a simple fill demo into an auditable replay engine with risk limits, order management, MFE/MAE, drawdown, and per-setup performance stats.

**Architecture:** Keep all trade lifecycle logic inside `simulation_engine`, expose typed Pydantic models from `orders.py`, let `export_fixture.py` include the richer metrics, and render those metrics in the existing workstation panels. Persistence remains unchanged in this slice because trades are still stored as JSON payloads through the repository boundary.

**Tech Stack:** Python 3.11, Pydantic, pytest; React 19, TypeScript, Vitest.

## Global Constraints

- Core market is XAU only and core timeframe is 5m.
- Phase one remains simulated only: no real broker, no MT5 order execution, no real account calls.
- Risk checks must stay in simulation/broker boundaries and not be hard-coded into the AI reasoning layer.
- Tests must prove deterministic replay behavior.
- Frontend must show auditable metrics without exposing hidden chain-of-thought.

---

### Task 1: Simulator Order Management and Risk Guard

**Files:**
- Modify: `services/api/tests/simulation_engine/test_engine.py`
- Modify: `services/api/paquant/simulation_engine/orders.py`
- Modify: `services/api/paquant/simulation_engine/engine.py`

**Interfaces:**
- Produces: `RiskSettings(max_risk_per_order: float | None, max_quantity: float | None)`
- Produces: `SimulationEngine.cancel_order(order_id: str) -> SimulatedOrder`
- Produces: `SimulationEngine.modify_order(order_id: str, entry: float | None = None, stop: float | None = None, target: float | None = None) -> SimulatedOrder`
- Extends: `OrderType` with `stop` and `stop_limit`

- [ ] **Step 1: Write failing tests**

Assert an oversized order is rejected, a submitted order can be modified before fill, a submitted order can be canceled, and a buy stop fills only after candle high crosses the stop entry.

- [ ] **Step 2: Run failing tests**

Run: `uv run pytest services/api/tests/simulation_engine/test_engine.py -q`

Expected: FAIL because risk settings and order management methods do not exist.

- [ ] **Step 3: Implement minimal simulator changes**

Keep deterministic matching and default risk settings permissive so existing fixtures keep working.

- [ ] **Step 4: Verify**

Run: `uv run pytest services/api/tests/simulation_engine/test_engine.py -q`

Expected: PASS.

### Task 2: MFE/MAE, Drawdown, and Setup Stats

**Files:**
- Modify: `services/api/tests/simulation_engine/test_engine.py`
- Modify: `services/api/paquant/simulation_engine/orders.py`
- Modify: `services/api/paquant/simulation_engine/engine.py`

**Interfaces:**
- Extends: `SimulatedTrade` with `mfe_points`, `mae_points`, `max_favorable_r`, `max_adverse_r`
- Produces: `SimulationEngine.performance_summary() -> PerformanceSummary`
- Produces: `SetupPerformance`

- [ ] **Step 1: Write failing analytics tests**

Assert the deterministic replay records MFE/MAE on the closed trade, computes max drawdown from equity curve, and returns per-setup stats.

- [ ] **Step 2: Run failing tests**

Run: `uv run pytest services/api/tests/simulation_engine/test_engine.py -q`

Expected: FAIL because analytics fields/methods do not exist.

- [ ] **Step 3: Implement analytics models and calculations**

Track open-position excursion while candles replay. Compute drawdown from realized equity curve and group closed trades by setup name.

- [ ] **Step 4: Verify**

Run: `uv run pytest services/api/tests/simulation_engine/test_engine.py -q`

Expected: PASS.

### Task 3: Fixture and Frontend Metrics

**Files:**
- Modify: `services/api/paquant/export_fixture.py`
- Modify: `services/api/tests/test_export_fixture.py`
- Modify: `apps/web/src/lib/workbenchTypes.ts`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/components/OrdersPanel.tsx`
- Modify: `apps/web/src/components/PerformanceStrip.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Extends fixture with `performanceSummary`
- Frontend displays MFE, MAE, max drawdown, average R, and setup stats.

- [ ] **Step 1: Write failing backend/frontend tests**

Assert `build_demo_fixture()` includes `performanceSummary` and the App renders MFE/MAE and max drawdown labels.

- [ ] **Step 2: Run failing tests**

Run:

```powershell
uv run pytest services/api/tests/test_export_fixture.py -q
pnpm --filter @paquant/web test -- src/App.test.tsx
```

- [ ] **Step 3: Implement fixture and UI changes**

Use the simulator summary; do not recompute trading analytics inside React.

- [ ] **Step 4: Verify**

Run the same commands and expect PASS.

### Task 4: Full Verification, Commit, Push, Deploy

- [ ] Run `uv run pytest`
- [ ] Run `uv run ruff check services/api`
- [ ] Run `pnpm test`
- [ ] Run `pnpm lint`
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm build`
- [ ] Run `pnpm test:e2e`
- [ ] Run `git diff --check`
- [ ] Run staged secret scan before commit
- [ ] Commit as `feat: add simulation analytics`
- [ ] Push `main`
- [ ] Deploy CloudBase service `paquant`

---

## Self-Review

- Spec coverage: this plan targets simulation engine requirements for risk limits, lifecycle controls, MFE/MAE, equity curve drawdown, and per-setup performance stats.
- Placeholder scan: no placeholders remain.
- Type consistency: backend uses snake_case Pydantic fields and fixture/frontend contracts use existing JSON conversion patterns.
