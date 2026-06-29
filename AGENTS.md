# PAquant Agent Guide

This repository is the PAquant project: an AI-native price action quant trading system inspired by Al Brooks' price action framework.

The canonical planning document is:

- `docs/superpowers/specs/2026-06-30-paquant-design.md`

Read that document before making architecture or implementation changes.

## Project Intent

PAquant should become a TradingView-like web application where AI traders analyze XAU 5-minute charts, draw structured annotations, simulate trades, journal decisions, and show performance metrics.

The first implementation phase does not connect live broker execution. It builds the high-quality core product:

- Brooks knowledge compilation.
- AI-native chart workbench.
- Tool-based drawing and measurement.
- XAU 5-minute replay data.
- One Brooks Generalist AI trader.
- Simulated trading.
- Trade journaling and replay.
- CloudBase public web preview.

## Non-Negotiable Constraints

- Use an isolated development environment before coding. Prefer `uv` for Python and `pnpm` for frontend packages.
- Never commit `.env.local`, real API keys, broker credentials, or raw secrets.
- Do not commit raw source PDFs. Compiled knowledge artifacts are allowed.
- Keep the repo public-safe at all times.
- Write tests for each module. Do not treat UI screenshots as the only validation.
- Keep modules decoupled. Avoid large files that mix data ingestion, chart rendering, AI reasoning, persistence, and simulation.
- The frontend must be desktop-web first and feel like a professional trading workstation, not a marketing site or generic card dashboard.
- The first phase uses local SQLite by default, with schema boundaries that can migrate to Postgres later.
- The first phase deploys the frontend to CloudBase environment `groy-env-d5g7okht7dcd202fe` with service name `paquant`.
- Live trading via Exness MT5 is a later phase and must stay behind a broker adapter and risk engine boundary.

## Preferred Architecture

Use these boundaries unless a documented design change is made:

- `knowledge-layer`: Brooks source catalog, concept graph, setup dossiers, reasoning playbooks.
- `data-layer`: XAU 5-minute data import, normalization, replay sessions.
- `chart-workbench`: chart object model and frontend rendering.
- `drawing-engine`: tool-callable trend lines, channels, boxes, Fibonacci, leg measurements, bar counts, deviation measurements.
- `model-provider`: DeepSeek, Qwen, MiniMax, Kimi, and future OpenAI adapters through one interface.
- `agent-runtime`: AI trader loop, action stream, structured outputs.
- `simulation-engine`: orders, fills, stops, targets, R multiples, MFE/MAE, equity curve.
- `audit-replay`: persisted chart objects, decisions, trades, reviews, replay state.
- `broker-adapter`: future MT5/Exness live execution boundary only.

## Development Style

- Prefer TDD or failing-test-first for core logic.
- For UI, verify layout with browser screenshots or Playwright checks before claiming done.
- Use structured data and typed schemas for AI outputs.
- Model calls must be mockable in tests.
- Record model usage/cost telemetry, but there is no hard daily budget cap.
- Show users auditable observations, drawings, measurements, hypotheses, invalidations, plans, and reviews. Do not rely on exposing hidden model chain-of-thought.

## Git Hygiene

- Keep commits scoped by stage or module.
- Run tests before committing.
- Run secret checks before pushing.
- If `.env.local` appears in `git status` as staged or untracked, stop and fix `.gitignore` before continuing.
