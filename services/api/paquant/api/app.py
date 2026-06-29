from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from paquant.agent_runtime.registry import list_trader_profiles
from paquant.audit_replay.repository import AuditRepository
from paquant.audit_replay.schema import create_schema
from paquant.export_fixture import build_demo_fixture, build_knowledge_browser_payload


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

    @app.post("/api/workbench/demo/runs", status_code=201)
    def create_demo_run() -> dict[str, Any]:
        payload = build_demo_fixture()
        run_id = _persist_workbench_payload(repository, payload)
        return _with_meta(payload, persisted=True, analysis_run_id=run_id, repository=repository)

    return app


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
            "llm_usage": repository.count_rows("llm_usage"),
            "drawing_objects": repository.count_rows("drawing_objects"),
            "orders": repository.count_rows("orders"),
            "trades": repository.count_rows("trades"),
            "journals": repository.count_rows("journals"),
        }
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
    for trade in payload["trades"]:
        repository.record_trade(order_id=f"{run_id}:{trade['order_id']}", payload=trade)
    for journal_entry in payload["journal"]:
        repository.record_journal(
            analysis_run_id=run_id,
            entry_type=journal_entry["event"],
            payload=journal_entry,
        )
    return run_id
