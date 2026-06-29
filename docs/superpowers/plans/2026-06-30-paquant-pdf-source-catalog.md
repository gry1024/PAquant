# PAquant PDF Source Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Brooks PDF source catalog and chapter extraction boundary required by the PAquant acceptance list, without committing raw PDFs or raw extracted book text.

**Architecture:** Keep catalog metadata in `knowledge_layer.source_catalog`. The module accepts local PDF paths and a pluggable text extractor, producing source metadata, file hashes, and chapter references only. The compiler remains responsible for original structured summaries.

**Tech Stack:** Python 3.11, Pydantic, pytest, stdlib regex/hashlib.

## Global Constraints

- Raw PDF files and raw extracted text must not be committed.
- Tests use temporary fake PDF files and fake text extractors.
- Catalog output contains metadata and chapter titles only.
- Source ids must match compiled knowledge source ids.

---

### Task 1: Source Catalog Tests

**Files:**
- Create: `services/api/tests/knowledge_layer/test_source_catalog.py`

**Interfaces:**
- Produces: `expected_brooks_sources`
- Produces: `extract_chapter_refs`
- Produces: `catalog_local_pdfs`

- [ ] Write failing tests for three expected Brooks sources.
- [ ] Write failing tests for chapter extraction from fake text.
- [ ] Write failing tests proving raw extracted text is absent from catalog JSON.

### Task 2: Source Catalog Implementation

**Files:**
- Create: `services/api/paquant/knowledge_layer/source_catalog.py`
- Modify: `services/api/paquant/knowledge_layer/__init__.py`

**Interfaces:**
- Adds source metadata and chapter refs typed models.
- Adds pluggable PDF text extractor protocol.

- [ ] Implement typed catalog models.
- [ ] Implement deterministic chapter regex extraction.
- [ ] Implement local file metadata with sha256.

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
- [ ] Commit as `feat: add Brooks PDF source catalog`
- [ ] Push `main`
