# PAquant Knowledge Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the phase-one Brooks knowledge browser: searchable compiled concepts, setup dossiers, case cards, reasoning playbooks, and source mappings exposed through the API and rendered inside the trading workstation.

**Architecture:** Extend `knowledge_layer` typed artifact models so the compiled knowledge remains structured and auditable. Add a thin FastAPI endpoint for the current committed artifact, include the richer object in the demo fixture, and replace the bottom knowledge list with a dense professional browser panel that can run from API data or static fixture fallback.

**Tech Stack:** Python 3.11, Pydantic, FastAPI, pytest; React 19, TypeScript, Vitest, Testing Library.

## Global Constraints

- Raw Brooks PDF text must not be committed.
- Compiled knowledge artifacts may be committed only as original structured summaries, metadata, source mappings, case cards, and playbooks.
- The frontend remains a dense desktop-first trading workstation, not a marketing page.
- The knowledge browser must show auditable source refs, questions, failure modes, and reasoning playbooks without exposing hidden model chain-of-thought.
- Local API fallback must keep the CloudBase static preview usable.

---

### Task 1: Knowledge Artifact Depth

**Files:**
- Modify: `services/api/tests/knowledge_layer/test_compiler.py`
- Modify: `services/api/paquant/knowledge_layer/compiler.py`
- Modify: `services/api/paquant/knowledge_layer/artifacts/brooks_core.json`

**Interfaces:**
- Extends: `KnowledgeSource` with `chapter_refs: list[str]`
- Extends: `SetupDossier` with `measurements`, `stop_logic`, `targets`, `management`, `nearby_setups`
- Produces: `CaseCard`
- Produces: `ReasoningPlaybook`
- Extends: `KnowledgeArtifact` with `case_cards` and `reasoning_playbooks`

- [ ] Write failing tests proving three-push depth, case cards, playbooks, and source chapter refs exist.
- [ ] Run `uv run pytest services/api/tests/knowledge_layer/test_compiler.py -q` and confirm failure.
- [ ] Implement richer artifact models and content without raw book dumps.
- [ ] Regenerate `brooks_core.json`.
- [ ] Run `uv run pytest services/api/tests/knowledge_layer/test_compiler.py -q` and confirm pass.

### Task 2: Knowledge API and Fixture Contract

**Files:**
- Modify: `services/api/tests/api/test_app.py`
- Modify: `services/api/tests/test_export_fixture.py`
- Modify: `services/api/paquant/api/app.py`
- Modify: `services/api/paquant/export_fixture.py`

**Interfaces:**
- Produces: `GET /api/knowledge -> KnowledgeArtifact JSON`
- Extends demo fixture `knowledge` with `sources`, `caseCards`, and `reasoningPlaybooks`

- [ ] Write failing API and fixture tests.
- [ ] Run `uv run pytest services/api/tests/api/test_app.py services/api/tests/test_export_fixture.py -q` and confirm failure.
- [ ] Implement endpoint and fixture mapping.
- [ ] Run the same command and confirm pass.

### Task 3: Frontend Knowledge Browser

**Files:**
- Create: `apps/web/src/components/KnowledgeBrowserPanel.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/components/Workbench.tsx`
- Modify: `apps/web/src/lib/workbenchTypes.ts`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/fixtures/paquant-demo.json`

**Interfaces:**
- Produces: `KnowledgeBrowserPanel({ knowledge })`
- Renders: concept index, selected dossier/case/playbook/source refs, and failure modes.

- [ ] Write failing App test assertions for `Knowledge browser`, `Case cards`, and `Reasoning playbooks`.
- [ ] Run `pnpm --filter @paquant/web test -- src/App.test.tsx` and confirm failure.
- [ ] Implement the panel and responsive dense layout.
- [ ] Run the same command and confirm pass.

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
- [ ] Commit as `feat: add Brooks knowledge browser`
- [ ] Push `main`
- [ ] Deploy CloudBase service `paquant`
- [ ] Verify CloudBase URL contains the new knowledge browser strings

---

## Self-Review

- Spec coverage: this plan targets the required knowledge browser, setup dossiers, examples/case cards, source mappings, and reasoning playbooks.
- Placeholder scan: no placeholders remain.
- Type consistency: backend snake_case fields are mapped to frontend camelCase fixture fields where the existing fixture already does so.
