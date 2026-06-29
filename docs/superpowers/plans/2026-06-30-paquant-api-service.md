# PAquant Local API Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing phase-one domain slice into a local product API that the web workstation can consume while preserving static CloudBase fallback behavior.

**Architecture:** Add a thin FastAPI adapter over the existing data, knowledge, agent, simulation, and audit modules. Keep business logic inside the current package boundaries, expose typed JSON contracts, and make the frontend load API data through a small data client with deterministic fixture fallback.

**Tech Stack:** Python 3.11, uv, FastAPI, SQLite, pytest, React 19, Vite, Vitest, Testing Library.

## Global Constraints

- Read `docs/superpowers/specs/2026-06-30-paquant-design.md` before implementation changes.
- Use `uv` for Python and `pnpm` for frontend packages.
- Never commit `.env.local`, real API keys, broker credentials, raw secrets, or raw source PDFs.
- Keep modules decoupled; do not mix chart rendering, AI reasoning, persistence, and simulation in one large file.
- Frontend remains desktop-web first and must feel like a professional trading workstation.
- First persistence target is local SQLite with portable schema boundaries.
- Live broker execution remains outside this task.

---

### Task 1: Backend API Contract

**Files:**
- Create: `services/api/tests/api/test_app.py`
- Create: `services/api/paquant/api/__init__.py`
- Create: `services/api/paquant/api/app.py`
- Modify: `pyproject.toml`

**Interfaces:**
- Produces: `create_app(database_path: str | Path = ":memory:") -> FastAPI`
- Produces: `GET /healthz -> {"service": "paquant-api", "status": "ok"}`
- Produces: `GET /api/workbench/demo -> Workbench payload plus metadata`
- Produces: `POST /api/workbench/demo/runs -> Workbench payload plus persisted audit run id`

- [x] Step 1: Write failing API tests for health, demo payload, and persisted run.
- [x] Step 2: Run `uv run pytest services/api/tests/api/test_app.py -q` and confirm import/route failure.
- [x] Step 3: Add FastAPI dependencies and implement `create_app` as a thin adapter around `build_demo_fixture`.
- [x] Step 4: Persist analysis run, model usage, drawing objects, order, trades, and journal rows through SQLite for the run endpoint.
- [x] Step 5: Run `uv run pytest services/api/tests/api/test_app.py -q` and confirm the new API tests pass.

### Task 2: Audit Repository Read/Write Coverage

**Files:**
- Modify: `services/api/tests/audit_replay/test_repository.py`
- Modify: `services/api/paquant/audit_replay/repository.py`

**Interfaces:**
- Produces: `record_order(...) -> None`
- Produces: `record_trade(...) -> int`
- Produces: `record_journal(...) -> int`
- Produces: `count_rows(table_name: str) -> int`

- [x] Step 1: Write failing repository tests proving orders, trades, journals, drawings, and model usage are all recorded.
- [x] Step 2: Run `uv run pytest services/api/tests/audit_replay/test_repository.py -q` and confirm missing-method failure.
- [x] Step 3: Implement narrow repository methods using parameterized SQL and JSON serialization.
- [x] Step 4: Run `uv run pytest services/api/tests/audit_replay/test_repository.py -q` and confirm pass.

### Task 3: Frontend Data Client and Loading States

**Files:**
- Create: `apps/web/src/lib/workbenchData.ts`
- Create: `apps/web/src/lib/workbenchData.test.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/Workbench.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Produces: `loadWorkbenchFixture(fetcher?: typeof fetch) -> Promise<WorkbenchFixture>`
- Produces: `Workbench` optional prop `sourceLabel?: string`

- [x] Step 1: Write failing Vitest tests for successful API loading and fixture fallback on fetch failure.
- [x] Step 2: Run `pnpm --filter @paquant/web test -- --run src/lib/workbenchData.test.ts src/App.test.tsx` and confirm missing-client failure.
- [x] Step 3: Implement `workbenchData.ts` and update `App.tsx` with loading, error fallback, and source label state.
- [x] Step 4: Update `Workbench` header to show API or fixture data source without changing chart contracts.
- [x] Step 5: Run the targeted Vitest command and confirm pass.

### Task 4: Verification and Documentation

**Files:**
- Modify: `README.md`

**Commands:**
- `uv run pytest`
- `uv run ruff check services/api`
- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `git diff --check`

- [x] Step 1: Document local API startup and frontend fallback behavior.
- [x] Step 2: Run all verification commands listed above.
- [x] Step 3: Inspect `git status --short` and ensure `.env.local`, raw PDFs, build artifacts, and secrets are not staged.
- [x] Step 4: Commit the API/frontend integration as a scoped feature commit.
