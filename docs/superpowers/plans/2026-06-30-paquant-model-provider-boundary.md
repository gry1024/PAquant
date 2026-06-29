# PAquant Model Provider Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the phase-one model provider boundary required by the PAquant design: provider metadata for DeepSeek, Qwen, MiniMax, and Kimi, a mockable OpenAI-compatible HTTP adapter, usage/cost telemetry, retry/fallback routing, schema versioning, and credential redaction.

**Architecture:** Keep provider-specific settings in `model_provider`. The agent continues to depend only on the `ModelProvider` protocol. Tests use fake transports and environment variables; no live calls or secrets are required.

**Tech Stack:** Python 3.11, Pydantic, pytest, stdlib `urllib`.

## Global Constraints

- Do not log or commit real API keys.
- Tests must use mock transports.
- Providers expose capability metadata separately from request execution.
- Prompt and output schema versions travel with `ModelRequest`.
- Fallback failures must preserve sanitized error messages only.

---

### Task 1: Provider Metadata and Config

**Files:**
- Modify: `services/api/paquant/model_provider/base.py`
- Create: `services/api/paquant/model_provider/registry.py`
- Modify: `services/api/tests/model_provider/test_mock.py`

**Interfaces:**
- Adds: `ModelCapability`
- Adds: `ProviderConfig`
- Adds: `build_default_provider_registry`

- [ ] Write failing tests for DeepSeek, Qwen, MiniMax, and Kimi metadata.
- [ ] Implement provider registry without requiring credentials at import time.

### Task 2: HTTP Adapter and Redaction

**Files:**
- Create: `services/api/paquant/model_provider/openai_compatible.py`
- Create: `services/api/tests/model_provider/test_openai_compatible.py`

**Interfaces:**
- Adds: `OpenAICompatibleProvider`
- Adds: `redact_secrets`
- Supports fake transport tests.

- [ ] Write failing tests for request payload, schema version metadata, usage parsing, and redaction.
- [ ] Implement adapter with mockable transport.

### Task 3: Fallback Router

**Files:**
- Create: `services/api/paquant/model_provider/router.py`
- Create: `services/api/tests/model_provider/test_router.py`

**Interfaces:**
- Adds: `FallbackModelProvider`
- Adds: sanitized provider failure telemetry.

- [ ] Write failing tests proving fallback to second provider.
- [ ] Implement router without exposing credentials in errors.

### Task 4: Full Verification, Commit, Push

- [ ] Run `uv run pytest`
- [ ] Run `uv run ruff check services/api`
- [ ] Run `pnpm test`
- [ ] Run `pnpm lint`
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm build`
- [ ] Run `pnpm test:e2e`
- [ ] Run `git diff --check`
- [ ] Run staged credential scan
- [ ] Commit as `feat: add model provider boundary`
- [ ] Push `main`
