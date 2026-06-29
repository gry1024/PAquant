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
    }
    assert len(payload["candles"]) >= 30
    assert payload["candles"][0]["symbol"] == "XAUUSD"
    assert payload["analysis"]["traderId"] == "brooks-generalist"
    assert payload["analysis"]["modelUsage"]["provider"] == "mock"
    assert any(obj["kind"] == "trendline" for obj in payload["chartObjects"])
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
        "llm_usage": 1,
        "drawing_objects": len(payload["chartObjects"]),
        "orders": len(payload["orders"]),
        "trades": len(payload["trades"]),
        "journals": len(payload["journal"]),
    }


def test_app_uses_environment_database_path_by_default(tmp_path: Path, monkeypatch):
    database_path = tmp_path / "env-paquant.sqlite3"
    monkeypatch.setenv("PAQUANT_DB_PATH", str(database_path))
    client = TestClient(create_app())

    response = client.post("/api/workbench/demo/runs")

    assert response.status_code == 201
    assert database_path.exists()
