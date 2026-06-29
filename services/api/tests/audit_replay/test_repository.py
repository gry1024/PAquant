import sqlite3

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
