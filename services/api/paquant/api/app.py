from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from paquant.agent_runtime.registry import list_trader_profiles
from paquant.audit_replay.repository import AuditRepository
from paquant.audit_replay.schema import create_schema
from paquant.export_fixture import build_demo_fixture, build_knowledge_browser_payload
from paquant.model_provider.base import ModelProvider
from paquant.model_provider.mock import MockModelProvider
from paquant.model_provider.openai_compatible import OpenAICompatibleProvider
from paquant.model_provider.registry import build_default_provider_registry


class AgentRunRequest(BaseModel):
    trader_id: str = Field(default="brooks-generalist", alias="traderId")
    model_provider: str = Field(default="mock", alias="modelProvider")


def create_app(database_path: str | Path | None = None) -> FastAPI:
    resolved_database_path = _resolve_database_path(database_path)
    connection = sqlite3.connect(resolved_database_path, check_same_thread=False)
    create_schema(connection)
    repository = AuditRepository(connection)
    _seed_trader_profiles(repository)

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

    @app.post("/api/agent-runs", status_code=201)
    def create_agent_run(request: AgentRunRequest) -> dict[str, Any]:
        provider = _build_model_provider(request.model_provider)
        payload = build_demo_fixture(model_provider=provider)
        run_id = _persist_workbench_payload(repository, payload)
        return _with_meta(
            payload,
            persisted=True,
            analysis_run_id=run_id,
            repository=repository,
            started_by="user",
            agent_status="completed",
        )

    @app.post("/api/workbench/demo/runs", status_code=201)
    def create_demo_run() -> dict[str, Any]:
        payload = build_demo_fixture()
        run_id = _persist_workbench_payload(repository, payload)
        return _with_meta(payload, persisted=True, analysis_run_id=run_id, repository=repository)

    return app


def _model_provider_payloads() -> list[dict[str, Any]]:
    providers = [
        {
            "id": "mock",
            "name": "Mock local",
            "model": MockModelProvider.model,
            "apiKeyEnv": None,
            "available": True,
            "capabilities": {
                "text": True,
                "vision": False,
                "structured_output": True,
                "tool_calling": True,
                "context_window": 16_000,
            },
        }
    ]
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


def _build_model_provider(provider_id: str) -> ModelProvider:
    if provider_id == "mock":
        return MockModelProvider()
    registry = build_default_provider_registry()
    config = registry.get(provider_id)
    if config is None:
        return MockModelProvider()
    if not os.environ.get(config.api_key_env):
        return MockModelProvider()
    return OpenAICompatibleProvider(config=config)


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
