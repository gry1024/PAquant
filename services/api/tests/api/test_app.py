from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from paquant.api.app import create_app
from paquant.data_layer.providers import LiveMarketFeed, LiveMarketQuote, LiveMarketSource
from paquant.data_layer.sample_data import load_sample_candles
from paquant.model_provider.base import (
    ModelProviderError,
    ModelRequest,
    ModelResponse,
    ModelToolCall,
    ModelUsage,
)


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
        "second-entry",
        "best-trades-only",
        "trading-range-scalper",
        "breakout-pullback",
        "wedge-reversal",
        "breakout-failure",
        "major-reversal",
        "final-flag",
    ]
    active = payload["traders"][0]
    assert active["status"] == "active"
    assert active["performance"]["winRate"] == 1.0
    assert active["performance"]["maxDrawdown"] == 0.0
    assert {"find_swings", "draw_trendline", "measure_leg"} <= set(active["toolPermissions"])
    assert active["agentFile"] == ".agents/traders/brooks-generalist.md"
    assert active["sharedKnowledgeFiles"] == [
        ".agents/common/price-action-core.md",
        ".agents/common/risk-control.md",
    ]
    assert "Shared Price Action Core" in active["sharedKnowledgeSummary"]
    assert "Shared Risk Control" in active["sharedKnowledgeSummary"]


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
    assert {"deepseek", "qwen", "minimax", "kimi"} <= provider_ids
    assert "mock" not in provider_ids
    deepseek = next(provider for provider in payload["providers"] if provider["id"] == "deepseek")
    assert deepseek["model"] == "deepseek-chat"
    assert deepseek["apiKeyEnv"] == "DEEPSEEK_API_KEY"
    assert deepseek["available"] is True
    assert deepseek["capabilities"]["tool_calling"] is True


class FakeRealModelProvider:
    def generate(self, request: ModelRequest) -> ModelResponse:
        return ModelResponse(
            text="Real provider test decision from non-mock model.",
            structured={"bias": "long"},
            tool_calls=[
                ModelToolCall(
                    id="real-test-tool-1",
                    name="draw_trendline",
                    arguments={
                        "id": "real-test-line",
                        "label": "Real model support line",
                        "start": {"time_index": 0, "price": 2306.5},
                        "end": {"time_index": 20, "price": 2320.5},
                    },
                ),
                ModelToolCall(
                    id="real-test-tool-2",
                    name="measure_leg",
                    arguments={
                        "start": {"time_index": 0, "price": 2306.5},
                        "end": {"time_index": 20, "price": 2320.5},
                    },
                ),
            ],
            usage=ModelUsage(
                provider="deepseek",
                model="deepseek-chat",
                input_tokens=120,
                output_tokens=64,
                estimated_cost_usd=0.000102,
            ),
        )


class FailingModelProvider:
    def generate(self, request: ModelRequest) -> ModelResponse:
        raise ModelProviderError("provider unavailable")


class FakeLiveProvider:
    def load_candles(self, symbol: str, timeframe: str) -> LiveMarketFeed:
        return LiveMarketFeed(
            source=LiveMarketSource(
                id="goldapi_spot",
                label="GoldAPI spot XAU/USD",
                instrument_symbol="XAUUSD",
                instrument_kind="spot",
                is_spot=True,
                is_mock=False,
                latency="live",
            ),
            quote=LiveMarketQuote(
                symbol="XAUUSD",
                price=2338.2,
                timestamp="2026-06-30T04:30:00Z",
                provider_symbol="XAU/USD",
            ),
            candles=load_sample_candles(),
        )


class FailingLiveProvider:
    def load_candles(self, symbol: str, timeframe: str) -> LiveMarketFeed:
        raise ConnectionError("provider unavailable")


def test_agent_run_endpoint_uses_non_mock_provider_and_returns_trade_annotations(
    tmp_path: Path, monkeypatch
):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    client = TestClient(
        create_app(
            database_path=tmp_path / "paquant.sqlite3",
            live_market_provider=FakeLiveProvider(),
            model_provider_overrides={"deepseek": FakeRealModelProvider()},
        )
    )

    response = client.post(
        "/api/agent-runs",
        json={"traderId": "brooks-generalist", "modelProvider": "deepseek"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["meta"]["agentStatus"] == "completed"
    assert payload["meta"]["startedBy"] == "user"
    assert payload["meta"]["modelProvider"] == "deepseek"
    assert payload["analysis"]["modelUsage"]["provider"] == "deepseek"
    assert payload["analysis"]["reasoningSummary"]
    assert payload["analysis"]["positionSizeSuggestion"] == 1
    assert payload["orders"][0]["quantity"] == 1
    assert payload["orders"][0]["reason"]
    assert payload["orders"][0]["order_type"] == "stop"
    assert payload["orders"][0]["activation_price"] == payload["orders"][0]["entry"]
    assert payload["orders"][0]["execution_plan"]["signal_bar_index"] >= 0
    assert payload["orders"][0]["execution_plan"]["trigger_price"] == payload["orders"][0]["entry"]
    assert "信号K线" in payload["orders"][0]["execution_plan"]["signal_bar_pattern"]
    assert "stop order" in payload["orders"][0]["execution_plan"]["entry_tactic"]
    marker_by_type = {
        marker["marker_type"]: marker
        for marker in payload["chartObjects"]
        if marker["kind"] == "trade_marker"
    }
    assert {"entry", "stop", "target"} <= set(marker_by_type)
    assert marker_by_type["entry"]["quantity"] == 1
    assert "reason" in marker_by_type["entry"]
    assert "止损" in marker_by_type["stop"]["label"]
    assert "止盈" in marker_by_type["target"]["label"]
    assert payload["meta"]["recordCounts"]["analysis_runs"] == 1


def test_agent_run_endpoint_accepts_browser_supplied_market_candles(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    client = TestClient(
        create_app(
            database_path=tmp_path / "paquant.sqlite3",
            live_market_provider=FakeLiveProvider(),
            model_provider_overrides={"deepseek": FakeRealModelProvider()},
        )
    )
    candles = [candle.model_dump(mode="json") for candle in load_sample_candles()[:24]]

    response = client.post(
        "/api/agent-runs",
        json={
            "traderId": "brooks-generalist",
            "modelProvider": "deepseek",
            "market": {
                "source": {
                    "id": "forexsb_dukascopy_xauusd_m5_browser",
                    "label": "ForexSB Dukascopy XAUUSD M5 history",
                    "instrumentSymbol": "XAUUSD",
                    "instrumentKind": "spot_history",
                    "isSpot": True,
                    "isMock": False,
                    "historyCompleteness": "historical_5m",
                    "latency": "browser_direct",
                },
                "candles": candles,
            },
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["meta"]["dataSource"]["id"] == "forexsb_dukascopy_xauusd_m5_browser"
    assert payload["meta"]["dataSource"]["isMock"] is False
    assert len(payload["candles"]) == 24
    assert payload["analysis"]["modelUsage"]["provider"] == "deepseek"
    marker_types = {
        obj["marker_type"] for obj in payload["chartObjects"] if obj["kind"] == "trade_marker"
    }
    assert marker_types >= {
        "entry",
        "stop",
        "target",
    }


def test_agent_run_returns_chinese_502_when_model_provider_fails(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    client = TestClient(
        create_app(
            database_path=tmp_path / "paquant.sqlite3",
            live_market_provider=FakeLiveProvider(),
            model_provider_overrides={"deepseek": FailingModelProvider()},
        )
    )

    response = client.post(
        "/api/agent-runs",
        json={"traderId": "brooks-generalist", "modelProvider": "deepseek"},
    )

    assert response.status_code == 502
    assert "模型 API 调用失败" in response.json()["detail"]


def test_live_market_endpoint_returns_non_mock_source_metadata(tmp_path: Path):
    client = TestClient(
        create_app(
            database_path=tmp_path / "paquant.sqlite3",
            live_market_provider=FakeLiveProvider(),
        )
    )

    response = client.get("/api/market/xau/live")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"]["id"] == "goldapi_spot"
    assert payload["source"]["isMock"] is False
    assert payload["source"]["isSpot"] is True
    assert payload["quote"]["price"] == 2338.2
    assert payload["quote"]["bid"] == 2337.85
    assert payload["quote"]["ask"] == 2338.55
    assert payload["candles"][0]["symbol"] == "XAUUSD"


def test_live_market_endpoint_rejects_local_replay_when_provider_fails(tmp_path: Path):
    client = TestClient(
        create_app(
            database_path=tmp_path / "paquant.sqlite3",
            live_market_provider=FailingLiveProvider(),
        )
    )

    response = client.get("/api/market/xau/live")

    assert response.status_code == 503
    assert "真实行情源暂不可用" in response.json()["detail"]


def test_agent_run_without_visible_market_rejects_local_replay_when_provider_fails(
    tmp_path: Path, monkeypatch
):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    client = TestClient(
        create_app(
            database_path=tmp_path / "paquant.sqlite3",
            live_market_provider=FailingLiveProvider(),
            model_provider_overrides={"deepseek": FakeRealModelProvider()},
        )
    )

    response = client.post(
        "/api/agent-runs",
        json={"traderId": "brooks-generalist", "modelProvider": "deepseek"},
    )

    assert response.status_code == 503
    assert "visible non-mock 5m candles" in response.json()["detail"]


def test_agent_run_rejects_mock_provider_for_live_mode(tmp_path: Path):
    client = TestClient(create_app(database_path=tmp_path / "paquant.sqlite3"))

    response = client.post(
        "/api/agent-runs",
        json={"traderId": "brooks-generalist", "modelProvider": "mock"},
    )

    assert response.status_code == 400
    assert "mock" in response.json()["detail"].lower()


def test_agent_run_rejects_unconfigured_real_provider_without_silent_fallback(
    tmp_path: Path, monkeypatch
):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    client = TestClient(create_app(database_path=tmp_path / "paquant.sqlite3"))

    response = client.post(
        "/api/agent-runs",
        json={"traderId": "brooks-generalist", "modelProvider": "deepseek"},
    )

    assert response.status_code == 400
    assert "DEEPSEEK_API_KEY" in response.json()["detail"]


def test_app_uses_environment_database_path_by_default(tmp_path: Path, monkeypatch):
    database_path = tmp_path / "env-paquant.sqlite3"
    monkeypatch.setenv("PAQUANT_DB_PATH", str(database_path))
    client = TestClient(create_app())

    response = client.post("/api/workbench/demo/runs")

    assert response.status_code == 201
    assert database_path.exists()
