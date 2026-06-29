# PAquant

PAquant is an AI-native price action quant trading project. The goal is to build a TradingView-like web workstation where AI traders analyze XAU 5-minute charts, draw structured annotations, simulate trades, journal decisions, and report performance.

The current repository is in planning and pre-development setup. The canonical design document is:

- [PAquant Pre-Development Design](docs/superpowers/specs/2026-06-30-paquant-design.md)

## Current Direction

- Frontend: CloudBase public preview, service name `paquant`.
- First phase: web-only, desktop-first.
- Data: XAU 5-minute historical replay first.
- Storage: local SQLite first, Postgres-compatible schema boundaries.
- AI: provider adapters for DeepSeek, Qwen, MiniMax, Kimi, and future OpenAI.
- Trading: simulation only in phase one; Exness MT5 live trading is a later phase.

## Safety

This is a public repository. Do not commit `.env.local`, real API keys, broker credentials, raw source PDFs, or other secrets.

## Local Development

The current phase-one slice uses a Python domain layer and a React/Vite web workstation.

```powershell
uv sync --all-groups
pnpm install
```

Run backend tests:

```powershell
uv run pytest
uv run ruff check services/api
```

Run the frontend:

```powershell
pnpm dev
```

Verify the frontend:

```powershell
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
```

If package downloads fail with `ECONNREFUSED 127.0.0.1:7890`, clear only the current shell's proxy variables and retry:

```powershell
Remove-Item Env:HTTP_PROXY,Env:HTTPS_PROXY,Env:ALL_PROXY -ErrorAction SilentlyContinue
```

## Implemented Phase-One Slice

- XAUUSD 5-minute deterministic replay data.
- Brooks structured knowledge artifact with source metadata.
- Serializable chart objects and drawing geometry helpers.
- Deterministic simulated order/trade engine with R multiple and equity curve.
- SQLite audit/replay schema and repository boundary.
- Mockable model provider and Brooks Generalist AI trader output schema.
- TradingView-like desktop web workstation with candlesticks, drawing overlay, analysis, simulated orders, journal, and performance panels.
