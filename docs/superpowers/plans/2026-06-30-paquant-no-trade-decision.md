# PAquant No-Trade Decision Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Brooks Generalist v1 able to produce a valid structured no-trade decision when replay context is neutral or lacks edge.

**Architecture:** Keep the decision in `agent_runtime`; simulation remains downstream and only receives a proposed order when one exists.

**Tech Stack:** Python 3.11, Pydantic, pytest.

## Global Constraints

- No hidden chain-of-thought exposure.
- No-trade output must still include market context, evidence, knowledge refs, invalidation, confidence, and model usage.
- Do not fake a simulated order when the decision is no-trade.

---

### Task 1: Failing Test

**Files:**
- Modify: `services/api/tests/agent_runtime/test_brooks_generalist.py`

**Interfaces:**
- Neutral replay returns `proposed_order=None` and a readable `no_trade_reason`.

- [x] Test neutral candles produce no-trade decision.

### Task 2: Implementation

**Files:**
- Modify: `services/api/paquant/agent_runtime/brooks_generalist.py`

**Interfaces:**
- Keep trade decision path unchanged for directional sample data.

- [x] Implement neutral/no-edge branch.

### Task 3: Verification, Commit, Push

- [x] Run `uv run pytest services/api/tests/agent_runtime/test_brooks_generalist.py -v`
- [x] Run `uv run pytest`
- [x] Run `uv run ruff check services/api`
- [x] Run `git diff --check`
- [x] Run staged secret scan
- [ ] Commit as `feat: add no-trade agent decision`
- [ ] Push `main`
