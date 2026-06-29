# PAquant Remote XAU Data Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a phase-one historical data acquisition boundary so PAquant can fetch and cache XAU 5-minute OHLCV CSV data instead of relying only on user-supplied manual files.

**Architecture:** Keep provider logic in `data_layer.providers`. Use a small source config plus a mockable text transport. The default parser remains the existing normalized OHLCV CSV parser.

**Tech Stack:** Python 3.11, Pydantic, pytest, stdlib `urllib`.

## Global Constraints

- Tests must not depend on external network.
- Remote data cache files are local runtime artifacts and should not be committed.
- Internal instrument remains `XAUUSD`; provider-specific aliases normalize through the existing parser.
- Only 5-minute data is supported in phase one.

---

### Task 1: Remote Provider Tests

**Files:**
- Modify: `services/api/tests/data_layer/test_providers.py`

**Interfaces:**
- Adds: `CsvDownloadSource`
- Adds: `RemoteCsvHistoricalDataProvider`
- Adds: `TextTransport`

- [ ] Write failing test for download, parse, and cache.
- [ ] Write failing test proving cached data loads without a second network call.

### Task 2: Remote Provider Implementation

**Files:**
- Modify: `services/api/paquant/data_layer/providers.py`
- Modify: `services/api/paquant/data_layer/__init__.py`

**Interfaces:**
- Provider implements `HistoricalDataProvider.load_candles`.
- Provider exposes `refresh_cache(force=False)`.

- [ ] Implement source config.
- [ ] Implement urllib-backed transport and injectable fake transport path.
- [ ] Implement cache read/write.

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
- [ ] Commit as `feat: add remote XAU data provider`
- [ ] Push `main`
