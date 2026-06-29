from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from paquant.api.app import create_app


def test_health_endpoint_reports_service_status(tmp_path: Path):
    client = TestClient(create_app(database_path=tmp_path / "paquant.sqlite3"))

    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"service": "paquant-api", "status": "ok"}


def test_demo_workbench_endpoint_returns_chart_contract(tmp_path: Path):
    client = TestClient(create_app(database_path=tmp_path / "paquant.sqlite3"))

    response = client.get("/api/workbench/demo")

    assert response.status_code == 200
    payload = response.json()
    assert payload["meta"] == {
        "source": "api",
        "symbol": "XAUUSD",
        "timeframe": "5m",
        "traderId": "brooks-generalist",
        "modelProvider": "mock",
        "model": "mock-brooks",
    }
    assert len(payload["candles"]) >= 30
    assert payload["candles"][0]["symbol"] == "XAUUSD"
    assert payload["analysis"]["traderId"] == "brooks-generalist"
    assert payload["analysis"]["modelUsage"]["provider"] == "mock"
    assert payload["agentActions"][0]["tool"] == "find_swings"
    assert any(action["tool"] == "draw_channel" for action in payload["agentActions"])
    assert payload["tradeReplay"][-1]["stage"] == "post-trade review"
    assert payload["tradeReplay"][-1]["outcome"] == "target"
    assert payload["tradeReplay"][-1]["snapshotId"] == payload["tradeSnapshots"][-1]["id"]
    assert payload["tradeSnapshots"][-1]["chartObjects"]
    assert any(obj["kind"] == "trendline" for obj in payload["chartObjects"])
    assert any(obj["kind"] == "channel" for obj in payload["chartObjects"])
    assert payload["trades"][0]["r_multiple"] == 2.0


def test_traders_endpoint_returns_configured_roster(tmp_path: Path):
    client = TestClient(create_app(database_path=tmp_path / "paquant.sqlite3"))

    response = client.get("/api/traders")

    assert response.status_code == 200
    payload = response.json()
    trader_ids = [trader["id"] for trader in payload["traders"]]
    assert trader_ids == [
        "brooks-generalist",
        "always-in-trend",
        "best-trades-only",
        "trading-range-scalper",
        "wedge-reversal",
        "breakout-failure",
    ]
    active = payload["traders"][0]
    assert active["status"] == "active"
    assert active["performance"]["winRate"] == 1.0
    assert active["performance"]["maxDrawdown"] == 0.0
    assert {"find_swings", "draw_trendline", "measure_leg"} <= set(
        active["toolPermissions"]
    )


def test_knowledge_endpoint_returns_browser_contract(tmp_path: Path):
    client = TestClient(create_app(database_path=tmp_path / "paquant.sqlite3"))

    response = client.get("/api/knowledge")

    assert response.status_code == 200
    payload = response.json()
    assert payload["version"] == "2026-06-30.phase-one"
    assert payload["sources"][0]["chapterRefs"]
    assert {case["key"] for case in payload["caseCards"]} >= {
        "three_push_channel_overshoot",
        "failed_breakout_range_reentry",
    }
    assert payload["reasoningPlaybooks"][0]["displayGuardrails"]


def test_demo_run_endpoint_persists_auditable_artifacts(tmp_path: Path):
    database_path = tmp_path / "paquant.sqlite3"
    client = TestClient(create_app(database_path=database_path))

    response = client.post("/api/workbench/demo/runs")

    assert response.status_code == 201
    payload = response.json()
    assert payload["meta"]["analysisRunId"] > 0
    assert payload["meta"]["persisted"] is True
    assert payload["meta"]["recordCounts"] == {
        "analysis_runs": 1,
        "agent_actions": len(payload["agentActions"]),
        "llm_usage": 1,
        "drawing_objects": len(payload["chartObjects"]),
        "orders": len(payload["orders"]),
        "trades": len(payload["trades"]),
        "trade_snapshots": len(payload["tradeSnapshots"]),
        "journals": len(payload["journal"]),
    }


def test_model_providers_endpoint_exposes_current_api_choices(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    client = TestClient(create_app(database_path=tmp_path / "paquant.sqlite3"))

    response = client.get("/api/model-providers")

    assert response.status_code == 200
    payload = response.json()
    provider_ids = {provider["id"] for provider in payload["providers"]}
    assert {"mock", "deepseek", "qwen", "minimax", "kimi"} <= provider_ids
    deepseek = next(provider for provider in payload["providers"] if provider["id"] == "deepseek")
    assert deepseek["model"] == "deepseek-chat"
    assert deepseek["apiKeyEnv"] == "DEEPSEEK_API_KEY"
    assert deepseek["available"] is True
    assert deepseek["capabilities"]["tool_calling"] is True


def test_agent_run_endpoint_requires_user_start_and_returns_trade_annotations(tmp_path: Path):
    client = TestClient(create_app(database_path=tmp_path / "paquant.sqlite3"))

    response = client.post(
        "/api/agent-runs",
        json={"traderId": "brooks-generalist", "modelProvider": "mock"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["meta"]["agentStatus"] == "completed"
    assert payload["meta"]["startedBy"] == "user"
    assert payload["meta"]["modelProvider"] == "mock"
    assert payload["analysis"]["modelUsage"]["provider"] == "mock"
    assert payload["analysis"]["reasoningSummary"]
    assert payload["analysis"]["positionSizeSuggestion"] == 1
    assert payload["orders"][0]["quantity"] == 1
    assert payload["orders"][0]["reason"]
    marker_by_type = {
        marker["marker_type"]: marker
        for marker in payload["chartObjects"]
        if marker["kind"] == "trade_marker"
    }
    assert {"entry", "stop", "target"} <= set(marker_by_type)
    assert marker_by_type["entry"]["quantity"] == 1
    assert "reason" in marker_by_type["entry"]
    assert "stop" in marker_by_type["stop"]["label"].lower()
    assert "target" in marker_by_type["target"]["label"].lower()
    assert payload["meta"]["recordCounts"]["analysis_runs"] == 1


def test_app_uses_environment_database_path_by_default(tmp_path: Path, monkeypatch):
    database_path = tmp_path / "env-paquant.sqlite3"
    monkeypatch.setenv("PAQUANT_DB_PATH", str(database_path))
    client = TestClient(create_app())

    response = client.post("/api/workbench/demo/runs")

    assert response.status_code == 201
    assert database_path.exists()
