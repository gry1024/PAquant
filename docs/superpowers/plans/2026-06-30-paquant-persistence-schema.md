# PAquant Persistence Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the phase-one SQLite persistence boundary named in the PAquant design while preserving compatibility with existing demo API writes.

**Architecture:** Keep DDL and SQLite helpers in `audit_replay`. Add canonical phase-one tables alongside existing compatibility tables. Repository methods should write structured JSON payloads and keep the schema portable to Postgres later.

**Tech Stack:** Python 3.11, sqlite3, pytest.

## Global Constraints

- Do not remove existing tables used by the API.
- Keep payloads JSON and table boundaries narrow.
- Do not introduce live broker execution or cloud database coupling.
- Tests must use in-memory SQLite.

---

### Task 1: Canonical Schema Coverage

**Files:**
- Modify: `services/api/tests/audit_replay/test_repository.py`
- Modify: `services/api/paquant/audit_replay/schema.py`

**Interfaces:**
- Adds canonical tables: `instruments`, `sessions`, `chart_objects`, `ai_traders`, `agent_runs`, `agent_actions`, `simulated_orders`, `simulated_trades`, `trade_reviews`, `knowledge_sources`, `knowledge_chunks`, `setup_dossiers`, `model_calls`

- [ ] Write failing schema coverage test.
- [ ] Add DDL without removing compatibility tables.

### Task 2: Repository Canonical Writes

**Files:**
- Modify: `services/api/tests/audit_replay/test_repository.py`
- Modify: `services/api/paquant/audit_replay/repository.py`

**Interfaces:**
- Adds canonical record/upsert methods for instruments, sessions, agent runs, chart objects, simulated orders/trades, reviews, knowledge artifacts, and model calls.

- [ ] Write failing repository write/count test.
- [ ] Implement narrow methods.

### Task 3: Full Verification, Commit, Push

- [ ] Run `uv run pytest`
- [ ] Run `uv run ruff check services/api`
- [ ] Run `pnpm test`
- [ ] Run `pnpm lint`
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm build`
- [ ] Run `pnpm test:e2e`
- [ ] Run `git diff --check`
- [ ] Run staged credential scan
- [ ] Commit as `feat: complete persistence schema`
- [ ] Push `main`
