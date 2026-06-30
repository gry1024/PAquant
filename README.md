# PAquant

PAquant is an AI-native price action quant trading project. The goal is to build a TradingView-like web workstation where AI traders analyze XAU 5-minute charts, draw structured annotations, simulate trades, journal decisions, and report performance.

The current repository contains the phase-one vertical slice for local simulation and the CloudBase public preview. The canonical design document is:

- [PAquant Pre-Development Design](docs/superpowers/specs/2026-06-30-paquant-design.md)

## Current Direction

- Frontend: CloudBase public preview, service name `paquant`.
- First phase: web-only, desktop-first.
- Data: browser-loaded ForexSB/Dukascopy XAUUSD M5 history plus a real XAU spot quote overlay from the CloudBase API.
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

Vite proxies `/api` to `http://127.0.0.1:8000` during local development. The workstation requires `/api/market/xau/live` for real quote/provider metadata and loads `https://data.forexsb.com/datafeed/data/dukascopy/XAUUSD5.lb.gz` in the browser for visible XAUUSD M5 candles. It shows explicit data-source labels instead of silently falling back to committed demo data.

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

## CloudBase Deployment

The public preview uses CloudBase static hosting for the frontend and a CloudBase SCF HTTP access service for the live API:

- Static preview: `https://groy-env-d5g7okht7dcd202fe-1401196005.tcloudbaseapp.com/PAquant/`
- API service: `https://groy-env-d5g7okht7dcd202fe-1401196005.ap-shanghai.app.tcloudbase.com/api`
- Function: `paquantScfApi`

The API should be deployed from `functions/paquant-api`:

```powershell
pnpm --package=@cloudbase/cli dlx tcb fn deploy paquantScfApi `
  --env-id groy-env-d5g7okht7dcd202fe `
  --force
```

Configure `DEEPSEEK_API_KEY`, `DASHSCOPE_API_KEY`, `MINIMAX_API_KEY`, and `MOONSHOT_API_KEY` as CloudBase function environment variables. Do not commit those values.

The frontend is built with Vite `base: "/PAquant/"` and `cloudbaserc.json` deploys static files to `/PAquant/`, so the product does not occupy the CloudBase environment root. The CloudBase environment currently blocks Yahoo Finance 5-minute chart endpoints with HTTP 429 and cannot download the full ForexSB M5 file within the function timeout. The deployed product therefore uses this split path:

- `/api/market/xau/live` returns real XAU spot quote metadata from CloudBase-accessible providers.
- The browser downloads and parses ForexSB/Dukascopy `XAUUSD5.lb.gz`, then displays the latest 240 XAUUSD M5 candles.
- When the user clicks `Start AI trader`, the frontend sends the visible non-mock M5 candles, source metadata, and quote to `/api/agent-runs`.
- The SCF function validates the candles before calling the selected model API, executing tool calls, drawing chart objects, and creating a simulated order with entry, stop, target, quantity, and reason.

## Implemented Phase-One Slice

- XAUUSD 5-minute deterministic replay data for tests and audit replay.
- Real XAU quote endpoint with source metadata and explicit quote-only labeling.
- Browser-side ForexSB/Dukascopy XAUUSD M5 parser for visible non-mock chart candles.
- Derived M15/H1 auxiliary context from the primary XAU 5-minute replay.
- Brooks structured knowledge artifact with source metadata.
- Deterministic Brooks knowledge retrieval surfaced in the AI trader audit trail.
- Serializable chart objects and drawing geometry helpers.
- Deterministic simulated order/trade engine with R multiple and equity curve.
- Stop-limit order state, risk guards, and configurable spread/slippage execution costs.
- SQLite audit/replay schema and repository boundary.
- Mockable model provider boundary and real API adapters for DeepSeek, Qwen, MiniMax, and Kimi.
- Brooks Generalist AI trader requires user start, validates visible non-mock M5 candles, calls the selected real model API, executes returned drawing tools, and rejects mock provider selection for live agent runs.
- Brooks Generalist trade and no-trade decision paths.
- Local FastAPI product API for health checks, live market payloads, provider status, and persisted user-started agent runs.
- TradingView-like desktop web workstation with candlesticks, drawing overlay, bar-by-bar stream controls, visible model API selection, analysis, knowledge refs, simulated orders, journal, replay snapshots, and performance panels.
- CloudBase static public preview at `https://groy-env-d5g7okht7dcd202fe-1401196005.tcloudbaseapp.com/PAquant/`.
