# PAquant Trade Replay Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the phase-one trade replay view required by the PAquant design: pre-entry context, AI drawings, plan, execution, outcome, and post-trade review.

**Architecture:** Expose a `tradeReplay` fixture/API contract from the backend and render it in a dedicated frontend panel. The replay is read-only and deterministic for the current demo session.

**Tech Stack:** Python 3.11, pytest; React 19, TypeScript, Vitest, Testing Library.

## Global Constraints

- Do not add live broker behavior.
- Replay steps must reference auditable chart objects and bar indices.
- The frontend remains dense and workstation-like.
- Static CloudBase fallback must include the replay data.

---

### Task 1: Backend Replay Contract

**Files:**
- Modify: `services/api/tests/test_export_fixture.py`
- Modify: `services/api/tests/api/test_app.py`
- Modify: `services/api/paquant/export_fixture.py`

**Interfaces:**
- Adds: `tradeReplay: list[TradeReplayStep]`
- Stages: pre-entry, plan, execution, outcome, post-trade review.

- [ ] Write failing tests for replay stages and chart object refs.
- [ ] Implement deterministic demo replay payload.

### Task 2: Frontend Replay Panel

**Files:**
- Create: `apps/web/src/components/TradeReplayPanel.tsx`
- Modify: `apps/web/src/lib/workbenchTypes.ts`
- Modify: `apps/web/src/components/Workbench.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/fixtures/paquant-demo.json`

**Interfaces:**
- Renders: `Trade replay`, `Pre-entry`, `Execution`, `Post-trade review`.

- [ ] Write failing component assertions.
- [ ] Implement panel and styles.
- [ ] Regenerate static fixture.

### Task 3: Full Verification, Commit, Push, Deploy

- [ ] Run `uv run pytest`
- [ ] Run `uv run ruff check services/api`
- [ ] Run `pnpm test`
- [ ] Run `pnpm lint`
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm build`
- [ ] Run `pnpm test:e2e`
- [ ] Run `git diff --check`
- [ ] Run staged credential scan
- [ ] Commit as `feat: add trade replay panel`
- [ ] Push `main`
- [ ] Deploy CloudBase service `paquant`
- [ ] Verify CloudBase URL contains replay strings
