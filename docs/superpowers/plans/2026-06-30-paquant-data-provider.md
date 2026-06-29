# PAquant Data Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a replaceable XAU 5m historical data provider/importer boundary so replay data can come from normalized provider exports instead of only hard-coded sample generation.

**Architecture:** Keep candle validation in `schemas.py`, add provider/import utilities in a focused `providers.py`, and keep `ReplaySession` as the cursor over normalized candles. The first implementation supports CSV exports and an in-memory provider; future Dukascopy/MT5 adapters can implement the same protocol without changing chart, agent, or simulation modules.

**Tech Stack:** Python 3.11, standard-library CSV parsing, Pydantic, pytest.

## Global Constraints

- Phase one supports internal symbol `XAUUSD` and timeframe `5m`.
- Provider-specific symbols such as `XAUUSDc`, `XAU/USD`, and `GOLD` must normalize to internal `XAUUSD`.
- Invalid instruments/timeframes must fail at the data boundary.
- No raw external data dumps should be committed; tests use inline CSV text only.

---

### Task 1: Provider Interface, Symbol Normalization, and CSV Import

**Files:**
- Create: `services/api/tests/data_layer/test_providers.py`
- Create: `services/api/paquant/data_layer/providers.py`
- Modify: `services/api/paquant/data_layer/__init__.py`

**Interfaces:**
- Produces: `normalize_instrument_symbol(value: str) -> str`
- Produces: `parse_ohlcv_csv(text: str, symbol: str, timeframe: str = "5m") -> list[Candle]`
- Produces: `HistoricalDataProvider` protocol with `load_candles(symbol: str, timeframe: str) -> list[Candle]`
- Produces: `InMemoryHistoricalDataProvider`

- [ ] Write failing tests for symbol normalization, CSV parsing, sorting, validation, and in-memory provider replay.
- [ ] Run `uv run pytest services/api/tests/data_layer/test_providers.py -q` and confirm failure.
- [ ] Implement provider utilities without adding network dependencies.
- [ ] Run `uv run pytest services/api/tests/data_layer -q` and confirm pass.

### Task 2: Verification and Commit

- [ ] Run `uv run pytest`
- [ ] Run `uv run ruff check services/api`
- [ ] Run `git diff --check`
- [ ] Run staged secret scan
- [ ] Commit as `feat: add XAU data provider boundary`
- [ ] Push `main`

---

## Self-Review

- Spec coverage: this plan addresses the data-layer requirement for a replaceable provider interface, symbol normalization, and loadable XAU 5m historical data.
- Placeholder scan: no placeholders remain.
