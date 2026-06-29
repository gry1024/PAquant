# PAquant Chart Replay Controls Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bar-by-bar replay controls to the chart workbench so the XAU 5m chart is not only a static full-session view.

**Architecture:** Keep replay state in the frontend workbench. The backend already provides deterministic candles and replay snapshots; the chart panel only receives the current visible candle count and callbacks.

**Tech Stack:** React 19, TypeScript, lightweight-charts, Vitest, Playwright.

## Global Constraints

- Keep the first screen a usable workstation, not a landing page.
- Replay controls must be compact and desktop-workstation appropriate.
- Do not mutate fixture data.
- Chart and drawing overlay must use the same visible candle window.

---

### Task 1: Failing Replay Control Test

**Files:**
- Modify: `apps/web/src/App.test.tsx`

**Interfaces:**
- The chart panel displays `Bar current/total`.
- `Reset replay` jumps to the first replay snapshot bar count.
- `Next bar` advances one candle.

- [x] Test default full replay counter.
- [x] Test reset and next-bar behavior.

### Task 2: Frontend Implementation

**Files:**
- Modify: `apps/web/src/components/Workbench.tsx`
- Modify: `apps/web/src/components/ChartPanel.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Adds chart panel props for visible candle count and replay callbacks.

- [x] Store visible candle count in Workbench.
- [x] Render compact replay buttons and counter.
- [x] Slice chart candle data and overlay input consistently.

### Task 3: Verification, Commit, Push, Deploy

- [x] Run `pnpm test`
- [x] Run `pnpm lint`
- [x] Run `pnpm typecheck`
- [x] Run `pnpm build`
- [x] Run `pnpm test:e2e`
- [x] Run `git diff --check`
- [x] Run staged secret scan
- [ ] Commit as `feat: add chart replay controls`
- [ ] Push `main`
- [ ] Deploy CloudBase service `paquant`
- [ ] Verify CloudBase URL contains replay controls
