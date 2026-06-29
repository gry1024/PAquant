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
        "journal",
        "knowledge",
    } <= set(payload)
    assert payload["candles"][0]["symbol"] == "XAUUSD"
    assert payload["analysis"]["traderId"] == "brooks-generalist"
