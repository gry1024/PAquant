# PAquant Drawing Tool Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the phase-one AI drawing and measurement command layer required by the PAquant design: the trader issues structured tool commands, the drawing engine executes deterministic geometry helpers, the action stream is persisted, and the frontend shows auditable tool actions.

**Architecture:** Keep drawing execution in `drawing_engine`, keep trader orchestration in `agent_runtime`, keep SQLite audit writes in `audit_replay`, and expose a camelCase fixture/API contract for the web app. Tools provide measurements and objects; the trader still decides market meaning.

**Tech Stack:** Python 3.11, Pydantic, pytest; React 19, TypeScript, Vitest, Testing Library.

## Global Constraints

- Tool commands must be deterministic against the sample XAU 5-minute candles.
- Tool results must be structured and serializable.
- Generated chart objects must use the existing chart object schema boundary.
- Frontend text must show observations and measurements without hidden chain-of-thought.
- CloudBase static fallback must keep working from the generated fixture.

---

### Task 1: Drawing Tool Executor

**Files:**
- Create: `services/api/paquant/drawing_engine/tools.py`
- Create: `services/api/tests/drawing_engine/test_tool_commands.py`
- Modify: `services/api/paquant/drawing_engine/__init__.py`

**Interfaces:**
- Produces: `ToolCommand`
- Produces: `AgentAction`
- Produces: `execute_drawing_plan(candles, commands)`
- Supports: `find_swings`, `draw_trendline`, `draw_channel`, `draw_box`, `draw_fibonacci`, `measure_leg`, `compare_legs`, `count_bars`, `project_line`, `measure_deviation`, `snap_to_swing`

- [ ] Write failing tests for complete Brooks tool coverage.
- [ ] Implement deterministic tool execution and serializable action results.
- [ ] Run `uv run pytest services/api/tests/drawing_engine/test_tool_commands.py -q`.

### Task 2: Agent and Audit Stream

**Files:**
- Modify: `services/api/tests/agent_runtime/test_brooks_generalist.py`
- Modify: `services/api/tests/audit_replay/test_repository.py`
- Modify: `services/api/paquant/agent_runtime/brooks_generalist.py`
- Modify: `services/api/paquant/audit_replay/schema.py`
- Modify: `services/api/paquant/audit_replay/repository.py`

**Interfaces:**
- Extends: `TraderDecision.action_stream`
- Adds SQLite table: `agent_actions`
- Adds repository method: `record_agent_action`

- [ ] Write failing tests for agent tool action stream and persistence.
- [ ] Implement trader plan execution and action persistence.
- [ ] Run targeted backend tests.

### Task 3: API, Fixture, and Frontend Display

**Files:**
- Modify: `services/api/tests/api/test_app.py`
- Modify: `services/api/tests/test_export_fixture.py`
- Modify: `services/api/paquant/export_fixture.py`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/components/TraderPanel.tsx`
- Modify: `apps/web/src/components/DrawingOverlay.tsx`
- Modify: `apps/web/src/components/Workbench.tsx`
- Modify: `apps/web/src/lib/workbenchTypes.ts`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/fixtures/paquant-demo.json`

**Interfaces:**
- Adds fixture/API field: `agentActions`
- Frontend renders: tool action stream, generated measurements, and channel overlay.

- [ ] Write failing API, fixture, and component assertions.
- [ ] Implement fixture mapping and UI.
- [ ] Regenerate `apps/web/src/fixtures/paquant-demo.json`.
- [ ] Run targeted API and frontend tests.

### Task 4: Full Verification, Commit, Push, Deploy

- [ ] Run `uv run pytest`
- [ ] Run `uv run ruff check services/api`
- [ ] Run `pnpm test`
- [ ] Run `pnpm lint`
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm build`
- [ ] Run `pnpm test:e2e`
- [ ] Run `git diff --check`
- [ ] Run staged credential scan
- [ ] Commit as `feat: add drawing tool command stream`
- [ ] Push `main`
- [ ] Deploy CloudBase service `paquant`
- [ ] Verify CloudBase URL contains the new tool action strings
