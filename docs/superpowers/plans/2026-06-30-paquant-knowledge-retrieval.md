# PAquant Knowledge Retrieval Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the Brooks Generalist AI trader to auditable Brooks knowledge retrieval instead of merely receiving the artifact as passive context.

**Architecture:** Add a small deterministic retrieval module inside `knowledge_layer`, expose typed `KnowledgeReference` records, pass them into `TraderDecision`, export them in the workbench fixture/API, and render them in the trader panel.

**Tech Stack:** Python 3.11, Pydantic, pytest; React 19, TypeScript, Vitest.

## Global Constraints

- Retrieval artifacts must be structured summaries and source metadata only.
- Do not expose raw hidden model chain-of-thought.
- Keep model calls mockable; retrieval is deterministic and local.
- The frontend should show concise references, not long book text.

---

### Task 1: Failing Retrieval Tests

**Files:**
- Create: `services/api/tests/knowledge_layer/test_retrieval.py`
- Modify: `services/api/tests/agent_runtime/test_brooks_generalist.py`
- Modify: `services/api/tests/test_export_fixture.py`
- Modify: `apps/web/src/App.test.tsx`

**Interfaces:**
- Adds `retrieve_relevant_knowledge()`.
- Adds `TraderDecision.knowledge_refs`.
- Adds `analysis.knowledgeRefs` in fixture/API.

- [x] Test retrieval returns ranked source-linked references.
- [x] Test Brooks Generalist decision includes knowledge refs.
- [x] Test fixture exports knowledge refs.
- [x] Test frontend renders knowledge refs.

### Task 2: Backend Implementation

**Files:**
- Create: `services/api/paquant/knowledge_layer/retrieval.py`
- Modify: `services/api/paquant/agent_runtime/brooks_generalist.py`
- Modify: `services/api/paquant/export_fixture.py`

**Interfaces:**
- `KnowledgeReference` with artifact type, key, title, summary, source refs, and score.

- [x] Implement deterministic token scoring over concepts, dossiers, case cards, and playbooks.
- [x] Include selected refs in trader decision and evidence trail.
- [x] Export refs in the analysis payload.

### Task 3: Frontend Implementation

**Files:**
- Modify: `apps/web/src/lib/workbenchTypes.ts`
- Modify: `apps/web/src/components/TraderPanel.tsx`

**Interfaces:**
- Trader panel renders concise knowledge refs.

- [x] Add typed `KnowledgeRef`.
- [x] Render source-linked references in trader panel.

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
- [ ] Commit as `feat: add Brooks knowledge retrieval`
- [ ] Push `main`
- [ ] Deploy CloudBase service `paquant`
- [ ] Verify CloudBase URL contains knowledge ref strings
