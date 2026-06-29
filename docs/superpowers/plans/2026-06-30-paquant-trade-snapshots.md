# PAquant Trade Snapshots Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add replayable trade chart snapshots to the phase-one audit loop so every simulated trade/replay stage can point to a bounded candle window and the exact chart objects visible at that decision point.

**Architecture:** Snapshots are structured JSON artifacts produced by the backend fixture/export layer, persisted through `audit_replay`, and rendered by the frontend replay panel. They are not screenshots on disk, so the public repo stays small and replayable.

**Tech Stack:** Python 3.11, SQLite, pytest; React 19, TypeScript, Vitest.

## Global Constraints

- Keep snapshots public-safe and deterministic.
- Do not store bitmap files or raw PDF/book content.
- Store chart object payloads as structured JSON so snapshots can be replayed later.
- Keep UI compact; the replay panel should summarize snapshot contents, not become a second chart.

---

### Task 1: Failing Snapshot Tests

**Files:**
- Modify: `services/api/tests/test_export_fixture.py`
- Modify: `services/api/tests/audit_replay/test_repository.py`
- Modify: `services/api/tests/api/test_app.py`
- Modify: `apps/web/src/App.test.tsx`

**Interfaces:**
- Adds `tradeSnapshots` to workbench payload.
- Adds `snapshotId` to each replay step.
- Adds repository method `record_trade_snapshot`.
- Adds API persisted count `trade_snapshots`.

- [x] Test fixture exposes replayable snapshots.
- [x] Test repository records trade snapshots.
- [x] Test API persists snapshot count.
- [x] Test frontend renders snapshot summary.

### Task 2: Backend Implementation

**Files:**
- Modify: `services/api/paquant/export_fixture.py`
- Modify: `services/api/paquant/audit_replay/repository.py`
- Modify: `services/api/paquant/api/app.py`

**Interfaces:**
- Snapshot payload includes id, order id, stage, candle window, candle subset, chart object ids, chart object payloads, captured time, and analysis summary.

- [x] Generate deterministic snapshots from trade replay steps.
- [x] Persist snapshots into `trade_snapshots`.
- [x] Include snapshot counts in API metadata.

### Task 3: Frontend Implementation

**Files:**
- Modify: `apps/web/src/lib/workbenchTypes.ts`
- Modify: `apps/web/src/components/TradeReplayPanel.tsx`
- Modify: `apps/web/src/components/Workbench.tsx`
- Modify: `apps/web/src/fixtures/paquant-demo.json`

**Interfaces:**
- Replay panel receives `steps` and `snapshots`.

- [x] Render snapshot candle window and chart object count.
- [x] Keep compact desktop panel layout.

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
- [ ] Commit as `feat: add replayable trade snapshots`
- [ ] Push `main`
- [ ] Deploy CloudBase service `paquant`
- [ ] Verify CloudBase URL contains snapshot strings
