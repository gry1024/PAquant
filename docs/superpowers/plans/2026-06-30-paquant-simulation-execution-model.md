# PAquant Simulation Execution Model Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the phase-one simulator's order execution semantics for stop-limit orders and deterministic spread/slippage costs without changing existing zero-cost fixture behavior.

**Architecture:** Keep execution rules in `simulation_engine`; do not move broker-specific logic into the AI trader or frontend. Default execution costs stay zero so replay tests and CloudBase fixture remain stable unless explicitly configured.

**Tech Stack:** Python 3.11, Pydantic, pytest.

## Global Constraints

- Phase one remains simulated only.
- Stop-limit support must be deterministic against candle OHLC data.
- Spread/slippage must be configurable, default to zero, and unfavorable to the trader.
- Existing limit/market/stop behavior must keep passing.

---

### Task 1: Failing Tests

**Files:**
- Modify: `services/api/tests/simulation_engine/test_engine.py`

**Interfaces:**
- Adds `OrderStatus.TRIGGERED` behavior for stop-limit orders.
- Adds `ExecutionSettings` for spread/slippage.

- [x] Test stop-limit trigger then limit fill.
- [x] Test spread/slippage affect actual entry, exit, pnl, and R multiple.

### Task 2: Engine Implementation

**Files:**
- Modify: `services/api/paquant/simulation_engine/orders.py`
- Modify: `services/api/paquant/simulation_engine/engine.py`
- Modify: `services/api/paquant/export_fixture.py`
- Modify: `apps/web/src/fixtures/paquant-demo.json`
- Modify: `apps/web/src/lib/workbenchTypes.ts`
- Modify: `apps/web/src/components/OrdersPanel.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Adds optional `activation_price` and `filled_entry`.
- Adds `ExecutionSettings`.
- Applies execution costs when filling and closing positions.

- [x] Implement stop-limit trigger state.
- [x] Apply deterministic execution costs.
- [x] Refresh fixture and display actual order fill details.

### Task 3: Verification and Commit

- [x] Run `uv run pytest services/api/tests/simulation_engine -v`
- [x] Run `uv run pytest`
- [x] Run `uv run ruff check services/api`
- [x] Run `git diff --check`
- [x] Run staged secret scan
- [ ] Commit as `feat: complete simulation execution model`
- [ ] Push `main`
