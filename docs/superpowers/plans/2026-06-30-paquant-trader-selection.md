# PAquant Trader Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI trader roster selectable in the workstation so users can choose a trader persona instead of only seeing a fixed active trader.

**Architecture:** Keep the demo analysis data tied to Brooks Generalist, but allow the visible selected profile, roster active state, status strip, and trader panel heading to reflect user selection. Future slices can attach separate analysis runs per profile.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library.

## Global Constraints

- Do not fake separate trading decisions for inactive research traders.
- Keep the roster dense and keyboard-accessible.
- Selection must work with API data and fixture fallback.

---

### Task 1: Interaction Test

**Files:**
- Modify: `apps/web/src/App.test.tsx`

**Interfaces:**
- Clicking a roster card changes active trader display.

- [x] Write failing test using Testing Library click.

### Task 2: UI Implementation

**Files:**
- Modify: `apps/web/src/components/Workbench.tsx`
- Modify: `apps/web/src/components/TraderRosterPanel.tsx`
- Modify: `apps/web/src/components/TraderPanel.tsx`

**Interfaces:**
- Adds: `TraderRosterPanel.onSelect`
- Adds: `TraderPanel.traderName`

- [x] Implement stateful active trader id.
- [x] Update status strip and panel heading.

### Task 3: Full Verification, Commit, Push, Deploy

- [x] Run `pnpm test`
- [x] Run `pnpm lint`
- [x] Run `pnpm typecheck`
- [x] Run `pnpm build`
- [x] Run `pnpm test:e2e`
- [x] Run `uv run pytest`
- [x] Run `uv run ruff check services/api`
- [x] Run `git diff --check`
- [x] Run staged credential scan
- [ ] Commit as `feat: add trader selection`
- [ ] Push `main`
- [ ] Deploy CloudBase service `paquant`
- [ ] Verify CloudBase URL contains selectable trader strings
