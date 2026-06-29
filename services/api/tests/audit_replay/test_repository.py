import sqlite3

from paquant.agent_runtime.registry import get_trader_profile
from paquant.audit_replay.repository import AuditRepository
from paquant.audit_replay.schema import create_schema, list_tables


def test_schema_contains_phase_one_tables():
    connection = sqlite3.connect(":memory:")

    create_schema(connection)

    assert {
        "candles",
        "trader_profiles",
        "analysis_runs",
        "drawing_objects",
        "orders",
        "trades",
        "trade_snapshots",
        "llm_usage",
        "journals",
    } <= set(list_tables(connection))


def test_repository_records_analysis_and_model_usage():
    connection = sqlite3.connect(":memory:")
    create_schema(connection)
    repository = AuditRepository(connection)

    run_id = repository.record_analysis_run(
        trader_id="brooks-generalist",
        symbol="XAUUSD",
        timeframe="5m",
        payload={"bias": "long"},
    )
    usage_id = repository.record_model_call(
        analysis_run_id=run_id,
        provider="mock",
        model="mock-brooks",
        input_tokens=100,
        output_tokens=50,
        estimated_cost_usd=0,
    )

    assert run_id > 0
    assert usage_id > 0


def test_repository_records_full_audit_artifacts():
    connection = sqlite3.connect(":memory:")
    create_schema(connection)
    repository = AuditRepository(connection)
    run_id = repository.record_analysis_run(
        trader_id="brooks-generalist",
        symbol="XAUUSD",
        timeframe="5m",
        payload={"bias": "long"},
    )

    repository.record_drawing_object(
        object_id="tl-primary",
        analysis_run_id=run_id,
        payload={"kind": "trendline", "label": "Always-in long trend line"},
    )
    repository.record_order(
        order_id="sim-XAUUSD-5m-test",
        analysis_run_id=run_id,
        payload={"side": "buy", "status": "closed"},
    )
    trade_id = repository.record_trade(
        order_id="sim-XAUUSD-5m-test",
        payload={"outcome": "target", "r_multiple": 2.0},
    )
    journal_id = repository.record_journal(
        analysis_run_id=run_id,
        entry_type="trade-review",
        payload={"event": "Target reached"},
    )

    assert trade_id > 0
    assert journal_id > 0
    assert repository.count_rows("analysis_runs") == 1
    assert repository.count_rows("drawing_objects") == 1
    assert repository.count_rows("orders") == 1
    assert repository.count_rows("trades") == 1
    assert repository.count_rows("journals") == 1


def test_repository_upserts_and_lists_trader_profiles():
    connection = sqlite3.connect(":memory:")
    create_schema(connection)
    repository = AuditRepository(connection)
    profile = get_trader_profile("brooks-generalist")

    repository.upsert_trader_profile(
        profile_id=profile.id,
        name=profile.name,
        payload=profile.model_dump(mode="json"),
    )
    repository.upsert_trader_profile(
        profile_id=profile.id,
        name=profile.name,
        payload={**profile.model_dump(mode="json"), "recent_action": "Updated action"},
    )

    rows = repository.list_trader_profiles()

    assert repository.count_rows("trader_profiles") == 1
    assert rows[0]["id"] == "brooks-generalist"
    assert rows[0]["name"] == "Brooks Generalist"
    assert rows[0]["recent_action"] == "Updated action"
