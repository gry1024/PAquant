# PAquant Trader Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the AI trader roster required by the PAquant design: multiple trader personas with status, preferred setups, risk style, tool permissions, default performance metrics, API access, persistence, and frontend display.

**Architecture:** Keep trader identity and configuration in `agent_runtime`, store profile snapshots through `audit_replay`, expose a thin FastAPI endpoint, and let the React workstation load the roster with a static fallback for CloudBase preview. The active Brooks Generalist remains the only implemented decision loop in this slice; other profiles are explicit configured personas marked as simulated/standby so the UI and persistence model are ready without pretending they trade live.

**Tech Stack:** Python 3.11, Pydantic, FastAPI, SQLite, pytest; React 19, TypeScript, Vite, Vitest, Testing Library.

## Global Constraints

- Repository: public GitHub repo `gry1024/PAquant`.
- Current implementation target: direct work on `main`.
- CloudBase environment: `groy-env-d5g7okht7dcd202fe`.
- CloudBase service name: `paquant`.
- Core market is XAU only and core timeframe is 5m.
- Phase one must not connect live broker execution or submit real orders.
- Future live target remains Exness MT5 Standard Cent `XAUUSDc`.
- Use `uv` for Python and `pnpm` for frontend packages.
- Never print, commit, or expose `.env.local`, real API keys, broker credentials, raw secrets, raw PDFs, videos, or temporary extraction files.
- Model provider calls must remain mockable and auditable.
- Frontend must stay a dense professional trading workstation, not a marketing page.

---

## Requirement Coverage Target

- AI trader list: implemented by `TraderProfile`, `list_trader_profiles()`, `/api/traders`, and a compact roster panel.
- Multiple trader personas: Brooks Generalist plus Always-In Trend, Best-Trades-Only Conservative, Trading Range Scalper, Wedge/Reversal Specialist, and Breakout/Failed Breakout.
- Status and recent action: each profile carries `status` and `recent_action`.
- Win rate, equity curve, drawdown: each profile carries deterministic default performance metrics.
- Tool permissions: each profile lists allowed drawing/measurement commands.
- Persistence: SQLite `trader_profiles` table gets repository read/write coverage.
- CloudBase fallback: frontend uses committed static roster data when the local API is unavailable.

---

### Task 1: Backend Trader Registry

**Files:**
- Create: `services/api/tests/agent_runtime/test_trader_registry.py`
- Create: `services/api/paquant/agent_runtime/registry.py`
- Modify: `services/api/paquant/agent_runtime/__init__.py`

**Interfaces:**
- Produces: `TraderProfile`
- Produces: `list_trader_profiles() -> list[TraderProfile]`
- Produces: `get_trader_profile(trader_id: str) -> TraderProfile`

- [ ] **Step 1: Write failing registry tests**

Add tests proving all six personas exist, IDs are stable, each profile is XAU/5m scoped, each profile has tool permissions, and unknown IDs raise `KeyError`.

- [ ] **Step 2: Run the failing tests**

Run: `uv run pytest services/api/tests/agent_runtime/test_trader_registry.py -q`

Expected: FAIL because `paquant.agent_runtime.registry` does not exist.

- [ ] **Step 3: Implement the registry**

Create frozen Pydantic models for `TraderPerformance` and `TraderProfile`, then return deterministic profile definitions.

- [ ] **Step 4: Verify**

Run: `uv run pytest services/api/tests/agent_runtime/test_trader_registry.py -q`

Expected: PASS.

### Task 2: Persistence and API Contract

**Files:**
- Modify: `services/api/tests/audit_replay/test_repository.py`
- Modify: `services/api/tests/api/test_app.py`
- Modify: `services/api/paquant/audit_replay/repository.py`
- Modify: `services/api/paquant/api/app.py`

**Interfaces:**
- Produces: `AuditRepository.upsert_trader_profile(profile_id: str, name: str, payload: dict[str, Any]) -> None`
- Produces: `AuditRepository.list_trader_profiles() -> list[dict[str, Any]]`
- Produces: `GET /api/traders -> {"traders": [...]}`

- [ ] **Step 1: Write failing repository and API tests**

Assert trader profile snapshots can be written/read from SQLite and `/api/traders` returns the full roster with `brooks-generalist` active.

- [ ] **Step 2: Run the failing tests**

Run: `uv run pytest services/api/tests/audit_replay/test_repository.py services/api/tests/api/test_app.py -q`

Expected: FAIL because repository/API methods are missing.

- [ ] **Step 3: Implement repository and endpoint**

Use parameterized SQL for upsert/list methods. Seed the roster into SQLite when `create_app()` starts, then return repository rows from `/api/traders`.

- [ ] **Step 4: Verify**

Run: `uv run pytest services/api/tests/audit_replay/test_repository.py services/api/tests/api/test_app.py -q`

Expected: PASS.

### Task 3: Frontend Roster Loader and Panel

**Files:**
- Create: `apps/web/src/lib/traderProfiles.ts`
- Create: `apps/web/src/lib/traderProfiles.test.ts`
- Create: `apps/web/src/components/TraderRosterPanel.tsx`
- Modify: `apps/web/src/lib/workbenchTypes.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/components/Workbench.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Produces: `TraderProfile` TypeScript interface.
- Produces: `loadTraderProfiles(fetcher?: typeof fetch) -> Promise<TraderProfile[]>`
- Produces: `TraderRosterPanel({ profiles, activeTraderId })`

- [ ] **Step 1: Write failing frontend tests**

Add Vitest coverage for API roster loading, fallback roster loading, and rendering multiple trader personas in the workstation.

- [ ] **Step 2: Run the failing tests**

Run: `pnpm --filter @paquant/web test -- --run src/lib/traderProfiles.test.ts src/App.test.tsx`

Expected: FAIL because the loader/component do not exist.

- [ ] **Step 3: Implement loader, types, and compact panel**

Keep copy short and operational. Render a dense roster strip/table with persona name, status, recent action, win rate, drawdown, and equity.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @paquant/web test -- --run src/lib/traderProfiles.test.ts src/App.test.tsx`

Expected: PASS.

### Task 4: Full Verification and Commit

**Files:**
- Modify: `README.md` if local API endpoints change materially.

- [ ] **Step 1: Run backend verification**

Run:

```powershell
uv run pytest
uv run ruff check services/api
```

- [ ] **Step 2: Run frontend verification**

Run:

```powershell
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

- [ ] **Step 3: Run repository hygiene checks**

Run:

```powershell
git diff --check
git status --short
git diff -- . ':(exclude).env.local'
```

Confirm `.env.local`, raw PDFs, real keys, and tmp artifacts are not staged or present in tracked diff.

- [ ] **Step 4: Commit**

Run:

```powershell
git add services/api apps/web docs/superpowers/plans/2026-06-30-paquant-trader-roster.md
git commit -m "feat: add PAquant trader roster"
```

---

## Self-Review

- Spec coverage: this plan implements the explicit AI trader list and multiple trader persona surface while preserving the single Brooks Generalist execution loop.
- Placeholder scan: no placeholder tasks remain.
- Type consistency: backend and frontend use `TraderProfile`, `status`, `recentAction`, `winRate`, `drawdown`, and `equity` consistently at API boundaries.
