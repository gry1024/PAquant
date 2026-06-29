from paquant.export_fixture import build_demo_fixture


def test_demo_fixture_contains_workbench_payload():
    payload = build_demo_fixture()

    assert {
        "candles",
        "chartObjects",
        "analysis",
        "orders",
        "trades",
        "equityCurve",
        "performanceSummary",
        "journal",
        "knowledge",
    } <= set(payload)
    assert payload["candles"][0]["symbol"] == "XAUUSD"
    assert payload["analysis"]["traderId"] == "brooks-generalist"
    assert payload["trades"][0]["mfe_points"] >= 10
    assert payload["trades"][0]["mae_points"] <= -3
    assert payload["performanceSummary"]["total_trades"] == 1
    assert payload["performanceSummary"]["setup_stats"][0]["setup_name"].startswith("Brooks")
