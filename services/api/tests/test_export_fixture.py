from paquant.export_fixture import build_demo_fixture


def test_demo_fixture_contains_workbench_payload():
    payload = build_demo_fixture()

    assert {
        "candles",
        "agentActions",
        "chartObjects",
        "analysis",
        "orders",
        "trades",
        "tradeReplay",
        "equityCurve",
        "performanceSummary",
        "journal",
        "knowledge",
    } <= set(payload)
    assert payload["candles"][0]["symbol"] == "XAUUSD"
    assert payload["analysis"]["traderId"] == "brooks-generalist"
    assert any(action["tool"] == "draw_channel" for action in payload["agentActions"])
    assert any(action["tool"] == "measure_deviation" for action in payload["agentActions"])
    assert [step["stage"] for step in payload["tradeReplay"]] == [
        "pre-entry",
        "plan",
        "execution",
        "outcome",
        "post-trade review",
    ]
    assert "tl-primary" in payload["tradeReplay"][0]["chartObjectIds"]
    assert payload["trades"][0]["mfe_points"] >= 10
    assert payload["trades"][0]["mae_points"] <= -3
    assert payload["performanceSummary"]["total_trades"] == 1
    assert payload["performanceSummary"]["setup_stats"][0]["setup_name"].startswith("Brooks")
    assert payload["knowledge"]["sources"][0]["chapterRefs"]
    assert payload["knowledge"]["caseCards"]
    assert payload["knowledge"]["reasoningPlaybooks"]
