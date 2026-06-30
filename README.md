# PAquant

PAquant is an AI-native price action quant trading project. The goal is to build a TradingView-like web workstation where AI traders analyze XAU 5-minute charts, draw structured annotations, simulate trades, journal decisions, and report performance.

The current repository contains the phase-one vertical slice for local simulation and the CloudBase public preview. The canonical design document is:

- [PAquant Pre-Development Design](docs/superpowers/specs/2026-06-30-paquant-design.md)

## Current Direction

- Frontend: CloudBase public preview, service name `paquant`.
- First phase: web-only, desktop-first.
- Data: live XAU 5-minute market feed first, currently labeled when a provider is a futures proxy rather than spot XAU.
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

Run the local API:

```powershell
pnpm api
```

The API exposes:

- `GET /healthz`
- `GET /api/market/xau/live`
- `GET /api/model-providers`
- `POST /api/agent-runs`
- `GET /api/traders`
- `GET /api/workbench/demo`
- `POST /api/workbench/demo/runs`

By default it writes local SQLite state to `tmp/paquant.sqlite3`. Override that path without committing secrets:

```powershell
$env:PAQUANT_DB_PATH="tmp/local-paquant.sqlite3"
pnpm api
```

Run the frontend in a second shell:

```powershell
pnpm dev
```

Vite proxies `/api` to `http://127.0.0.1:8000` during local development. The live workstation requires `/api/market/xau/live`; it shows an explicit live-data error instead of silently falling back to committed demo data.

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

- XAUUSD 5-minute deterministic replay data for tests and audit replay.
- Live XAU market feed endpoint with source metadata, including explicit futures-proxy labeling when the source is not spot XAU.
- Derived M15/H1 auxiliary context from the primary XAU 5-minute replay.
- Brooks structured knowledge artifact with source metadata.
- Deterministic Brooks knowledge retrieval surfaced in the AI trader audit trail.
- Serializable chart objects and drawing geometry helpers.
- Deterministic simulated order/trade engine with R multiple and equity curve.
- Stop-limit order state, risk guards, and configurable spread/slippage execution costs.
- SQLite audit/replay schema and repository boundary.
- Mockable model provider boundary and real API adapters for DeepSeek, Qwen, MiniMax, and Kimi.
- Brooks Generalist AI trader requires tool calls in live mode, executes returned drawing tools, and rejects mock provider selection for live agent runs.
- Brooks Generalist trade and no-trade decision paths.
- Local FastAPI product API for health checks, live market payloads, provider status, and persisted user-started agent runs.
- TradingView-like desktop web workstation with candlesticks, drawing overlay, bar-by-bar stream controls, visible model API selection, analysis, knowledge refs, simulated orders, journal, replay snapshots, and performance panels.
- CloudBase static public preview at `https://paquant-groy-env-d5g7okht7dcd202fe.webapps.tcloudbase.com`.
