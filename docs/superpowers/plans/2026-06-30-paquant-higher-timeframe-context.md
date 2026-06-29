# PAquant Higher Timeframe Context Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auxiliary M15/H1 context derived from XAU 5m replay candles without changing the phase-one primary decision timeframe.

**Architecture:** Keep raw candle schema restricted to XAUUSD 5m. Add a derived data-layer summary for auxiliary timeframes and expose it through the workbench fixture/API for frontend display.

**Tech Stack:** Python 3.11, Pydantic, pytest; React 19, TypeScript, Vitest.

## Global Constraints

- Core traded/replayed timeframe remains 5m only.
- M15/H1 are derived context, not alternate trading sessions.
- No external data fetch is required for this slice.

---

### Task 1: Failing Tests

**Files:**
- Create: `services/api/tests/data_layer/test_timeframes.py`
- Modify: `services/api/tests/test_export_fixture.py`
- Modify: `apps/web/src/App.test.tsx`

**Interfaces:**
- Adds `build_higher_timeframe_context(candles)`.
- Adds `higherTimeframeContext` to workbench payload.

- [x] Test M15/H1 summaries are derived from 5m candles.
- [x] Test fixture exports higher timeframe context.
- [x] Test frontend renders M15 and H1 context chips.

### Task 2: Backend Implementation

**Files:**
- Create: `services/api/paquant/data_layer/timeframes.py`
- Modify: `services/api/paquant/export_fixture.py`

**Interfaces:**
- `HigherTimeframeContext` includes timeframe, bar count, bias, high, low, last close, and summary.

- [x] Implement deterministic aggregation.
- [x] Export context in fixture/API.

### Task 3: Frontend Implementation

**Files:**
- Modify: `apps/web/src/lib/workbenchTypes.ts`
- Modify: `apps/web/src/components/Workbench.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Status strip renders auxiliary M15/H1 context.

- [x] Add typed context.
- [x] Render compact timeframe chips.

### Task 4: Verification, Commit, Push, Deploy

- [x] Run `uv run pytest`
- [x] Run `uv run ruff check services/api`
- [x] Run `pnpm test`
- [x] Run `pnpm lint`
- [x] Run `pnpm typecheck`
- [x] Run `pnpm build`
- [x] Run `pnpm test:e2e`
- [x] Run `git diff --check`
- [x] Run staged secret scan
- [ ] Commit as `feat: add auxiliary timeframe context`
- [ ] Push `main`
- [ ] Deploy CloudBase service `paquant`
- [ ] Verify CloudBase URL contains M15/H1 context strings
