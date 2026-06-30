from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from paquant.agent_runtime.registry import list_trader_profiles
from paquant.audit_replay.repository import AuditRepository
from paquant.audit_replay.schema import create_schema
from paquant.data_layer.providers import YahooGoldFuturesChartProvider
from paquant.data_layer.schemas import Candle
from paquant.export_fixture import build_demo_fixture, build_knowledge_browser_payload
from paquant.model_provider.base import ModelProvider
from paquant.model_provider.openai_compatible import OpenAICompatibleProvider
from paquant.model_provider.registry import build_default_provider_registry


class AgentRunRequest(BaseModel):
    trader_id: str = Field(default="brooks-generalist", alias="traderId")
    model_provider: str = Field(default="deepseek", alias="modelProvider")
    market: dict[str, Any] | None = None


def create_app(
    database_path: str | Path | None = None,
    *,
    live_market_provider: Any | None = None,
    model_provider_overrides: dict[str, ModelProvider] | None = None,
    load_env_file: bool | None = None,
) -> FastAPI:
    should_load_env_file = load_env_file if load_env_file is not None else database_path is None
    if should_load_env_file:
        _load_local_env_file()
    resolved_database_path = _resolve_database_path(database_path)
    connection = sqlite3.connect(resolved_database_path, check_same_thread=False)
    create_schema(connection)
    repository = AuditRepository(connection)
    _seed_trader_profiles(repository)
    live_provider = live_market_provider or YahooGoldFuturesChartProvider()
    provider_overrides = model_provider_overrides or {}

    app = FastAPI(title="PAquant API", version="0.1.0")
    app.state.connection = connection
    app.state.audit_repository = repository

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://127.0.0.1:5174"],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"service": "paquant-api", "status": "ok"}

    @app.get("/api/workbench/demo")
    def get_demo_workbench() -> dict[str, Any]:
        return _with_meta(build_demo_fixture(), persisted=False)

    @app.get("/api/traders")
    def get_traders() -> dict[str, Any]:
        profiles_by_id = {profile["id"]: profile for profile in repository.list_trader_profiles()}
        ordered_profiles = [
            _profile_to_api(profiles_by_id[profile.id]) for profile in list_trader_profiles()
        ]
        return {"traders": ordered_profiles}

    @app.get("/api/knowledge")
    def get_knowledge() -> dict[str, Any]:
        return build_knowledge_browser_payload()

    @app.get("/api/model-providers")
    def get_model_providers() -> dict[str, Any]:
        return {"providers": _model_provider_payloads()}

    @app.get("/api/market/xau/live")
    def get_live_xau_market() -> dict[str, Any]:
        feed = live_provider.load_candles("XAUUSD", "5m")
        return _live_market_payload(feed)

    @app.post("/api/agent-runs", status_code=201)
    def create_agent_run(request: AgentRunRequest) -> dict[str, Any]:
        provider = _build_model_provider(request.model_provider, provider_overrides)
        if request.market is not None:
            candles = _client_market_candles(request.market)
            data_source = _client_market_source(request.market)
        else:
            live_feed = live_provider.load_candles("XAUUSD", "5m")
            candles = live_feed.candles
            data_source = live_feed.source.model_dump(mode="json", by_alias=True)
        payload = build_demo_fixture(model_provider=provider, candles=candles)
        run_id = _persist_workbench_payload(repository, payload)
        return _with_meta(
            payload,
            persisted=True,
            analysis_run_id=run_id,
            repository=repository,
            started_by="user",
            agent_status="completed",
            data_source=data_source,
        )

    @app.post("/api/workbench/demo/runs", status_code=201)
    def create_demo_run() -> dict[str, Any]:
        payload = build_demo_fixture()
        run_id = _persist_workbench_payload(repository, payload)
        return _with_meta(payload, persisted=True, analysis_run_id=run_id, repository=repository)

    return app


def _client_market_candles(market: dict[str, Any]) -> list[Candle]:
    source = market.get("source") or {}
    raw_candles = market.get("candles")
    if source.get("isMock") is True or not isinstance(raw_candles, list) or len(raw_candles) < 20:
        raise HTTPException(
            status_code=400,
            detail=(
                "agent run requires non-mock 5m candles from the visible chart "
                "before model tools can run"
            ),
        )
    try:
        return [Candle.model_validate(candle) for candle in raw_candles]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"invalid market candles: {exc}") from exc


def _client_market_source(market: dict[str, Any]) -> dict[str, Any]:
    source = dict(market.get("source") or {})
    source.setdefault("id", "browser_xauusd_5m")
    source.setdefault("label", "Browser supplied XAUUSD 5m candles")
    source.setdefault("instrumentSymbol", "XAUUSD")
    source.setdefault("instrumentKind", "spot_history")
    source.setdefault("isSpot", True)
    source["isMock"] = False
    source.setdefault("historyCompleteness", "historical_5m")
    source.setdefault("latency", "browser_direct")
    return source


def _model_provider_payloads() -> list[dict[str, Any]]:
    providers = []
    for provider_id, config in build_default_provider_registry().items():
        providers.append(
            {
                "id": provider_id,
                "name": provider_id.title(),
                "model": config.model,
                "apiKeyEnv": config.api_key_env,
                "available": bool(os.environ.get(config.api_key_env)),
                "capabilities": config.capabilities.model_dump(mode="json"),
            }
        )
    return providers


def _build_model_provider(
    provider_id: str,
    overrides: dict[str, ModelProvider] | None = None,
) -> ModelProvider:
    if provider_id == "mock":
        raise HTTPException(
            status_code=400,
            detail="mock provider is test-only and cannot run live AI trader mode",
        )
    if overrides and provider_id in overrides:
        return overrides[provider_id]
    registry = build_default_provider_registry()
    config = registry.get(provider_id)
    if config is None:
        raise HTTPException(status_code=400, detail=f"unknown model provider: {provider_id}")
    if not os.environ.get(config.api_key_env):
        raise HTTPException(
            status_code=400,
            detail=(
                f"model provider {provider_id} is not configured; "
                f"set {config.api_key_env}"
            ),
        )
    return OpenAICompatibleProvider(config=config)


def _live_market_payload(feed: Any) -> dict[str, Any]:
    return {
        "source": feed.source.model_dump(mode="json", by_alias=True),
        "quote": feed.quote.model_dump(mode="json", by_alias=True),
        "candles": [candle.model_dump(mode="json") for candle in feed.candles],
    }


def _load_local_env_file() -> None:
    for path in _candidate_env_files():
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            if line.startswith("export "):
                line = line.removeprefix("export ").strip()
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
        return


def _candidate_env_files() -> list[Path]:
    candidates: list[Path] = []
    seen: set[Path] = set()
    starts = [Path.cwd(), Path(__file__).resolve()]
    for start in starts:
        base = start if start.is_dir() else start.parent
        for parent in [base, *base.parents]:
            candidate = parent / ".env.local"
            if candidate not in seen:
                candidates.append(candidate)
                seen.add(candidate)
    return candidates


def _resolve_database_path(database_path: str | Path | None) -> str:
    candidate = database_path or os.environ.get("PAQUANT_DB_PATH", "tmp/paquant.sqlite3")
    if str(candidate) == ":memory:":
        return ":memory:"
    path = Path(candidate)
    path.parent.mkdir(parents=True, exist_ok=True)
    return str(path)


def _seed_trader_profiles(repository: AuditRepository) -> None:
    for profile in list_trader_profiles():
        repository.upsert_trader_profile(
            profile_id=profile.id,
            name=profile.name,
            payload=profile.model_dump(mode="json"),
        )


def _profile_to_api(profile: dict[str, Any]) -> dict[str, Any]:
    performance = profile["performance"]
    return {
        "id": profile["id"],
        "name": profile["name"],
        "persona": profile["persona"],
        "status": profile["status"],
        "symbol": profile["symbol"],
        "timeframe": profile["timeframe"],
        "preferredSetups": profile["preferred_setups"],
        "riskStyle": profile["risk_style"],
        "toolPermissions": profile["tool_permissions"],
        "knowledgePolicy": profile["knowledge_policy"],
        "recentAction": profile["recent_action"],
        "performance": {
            "equity": performance["equity"],
            "winRate": performance["win_rate"],
            "maxDrawdown": performance["max_drawdown"],
            "trades": performance["trades"],
            "averageR": performance["average_r"],
        },
    }


def _with_meta(
    payload: dict[str, Any],
    *,
    persisted: bool,
    analysis_run_id: int | None = None,
    repository: AuditRepository | None = None,
    started_by: str | None = None,
    agent_status: str | None = None,
    data_source: dict[str, Any] | None = None,
) -> dict[str, Any]:
    analysis = payload["analysis"]
    enriched = dict(payload)
    meta: dict[str, Any] = {
        "source": "api",
        "symbol": "XAUUSD",
        "timeframe": "5m",
        "traderId": analysis["traderId"],
    }
    if analysis_run_id is not None:
        meta["analysisRunId"] = analysis_run_id
    if persisted:
        meta["persisted"] = True
    if repository is not None:
        meta["recordCounts"] = {
            "analysis_runs": repository.count_rows("analysis_runs"),
            "agent_actions": repository.count_rows("agent_actions"),
            "llm_usage": repository.count_rows("llm_usage"),
            "drawing_objects": repository.count_rows("drawing_objects"),
            "orders": repository.count_rows("orders"),
            "trades": repository.count_rows("trades"),
            "trade_snapshots": repository.count_rows("trade_snapshots"),
            "journals": repository.count_rows("journals"),
        }
    usage = analysis["modelUsage"]
    meta["modelProvider"] = usage["provider"]
    meta["model"] = usage["model"]
    if started_by is not None:
        meta["startedBy"] = started_by
    if agent_status is not None:
        meta["agentStatus"] = agent_status
    if data_source is not None:
        meta["dataSource"] = data_source
    enriched["meta"] = meta
    return enriched


def _persist_workbench_payload(repository: AuditRepository, payload: dict[str, Any]) -> int:
    analysis = payload["analysis"]
    run_id = repository.record_analysis_run(
        trader_id=analysis["traderId"],
        symbol="XAUUSD",
        timeframe="5m",
        payload=analysis,
    )
    usage = analysis["modelUsage"]
    repository.record_model_call(
        analysis_run_id=run_id,
        provider=usage["provider"],
        model=usage["model"],
        input_tokens=usage["input_tokens"],
        output_tokens=usage["output_tokens"],
        estimated_cost_usd=usage["estimated_cost_usd"],
    )
    for action in payload["agentActions"]:
        repository.record_agent_action(
            analysis_run_id=run_id,
            sequence=action["sequence"],
            tool=action["tool"],
            payload=action,
        )
    for chart_object in payload["chartObjects"]:
        repository.record_drawing_object(
            object_id=f"{run_id}:{chart_object['id']}",
            analysis_run_id=run_id,
            payload=chart_object,
        )
    for order in payload["orders"]:
        repository.record_order(
            order_id=f"{run_id}:{order['id']}",
            analysis_run_id=run_id,
            payload=order,
        )
    trade_row_ids_by_order_id: dict[str, int] = {}
    for trade in payload["trades"]:
        trade_id = repository.record_trade(
            order_id=f"{run_id}:{trade['order_id']}", payload=trade
        )
        trade_row_ids_by_order_id[trade["order_id"]] = trade_id
    for snapshot in payload.get("tradeSnapshots", []):
        trade_id = trade_row_ids_by_order_id.get(snapshot["tradeOrderId"])
        if trade_id is not None:
            repository.record_trade_snapshot(trade_id=trade_id, payload=snapshot)
    for journal_entry in payload["journal"]:
        repository.record_journal(
            analysis_run_id=run_id,
            entry_type=journal_entry["event"],
            payload=journal_entry,
        )
    return run_id
