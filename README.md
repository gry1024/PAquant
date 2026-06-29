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
