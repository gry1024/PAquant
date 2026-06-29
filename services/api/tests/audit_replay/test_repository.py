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
        "agent_actions",
        "drawing_objects",
        "orders",
        "trades",
        "trade_snapshots",
        "llm_usage",
        "journals",
    } <= set(list_tables(connection))
    assert {
        "instruments",
        "sessions",
        "chart_objects",
        "ai_traders",
        "agent_runs",
        "agent_actions",
        "simulated_orders",
        "simulated_trades",
        "trade_reviews",
        "knowledge_sources",
        "knowledge_chunks",
        "setup_dossiers",
        "model_calls",
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
    action_id = repository.record_agent_action(
        analysis_run_id=run_id,
        sequence=1,
        tool="draw_trendline",
        payload={
            "tool": "draw_trendline",
            "status": "ok",
            "chart_object_id": "tl-primary",
        },
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
    snapshot_id = repository.record_trade_snapshot(
        trade_id=trade_id,
        payload={
            "id": "snapshot-outcome",
            "candleWindow": {"startIndex": 0, "endIndex": 12},
            "chartObjectIds": ["tl-primary"],
        },
    )
    journal_id = repository.record_journal(
        analysis_run_id=run_id,
        entry_type="trade-review",
        payload={"event": "Target reached"},
    )

    assert action_id > 0
    assert trade_id > 0
    assert snapshot_id > 0
    assert journal_id > 0
    assert repository.count_rows("analysis_runs") == 1
    assert repository.count_rows("agent_actions") == 1
    assert repository.count_rows("drawing_objects") == 1
    assert repository.count_rows("orders") == 1
    assert repository.count_rows("trades") == 1
    assert repository.count_rows("trade_snapshots") == 1
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


def test_repository_records_canonical_phase_one_entities():
    connection = sqlite3.connect(":memory:")
    create_schema(connection)
    repository = AuditRepository(connection)

    repository.upsert_instrument(
        symbol="XAUUSD",
        display_name="Gold spot",
        payload={"broker_symbol": "XAUUSDc"},
    )
    session_id = repository.record_session(
        symbol="XAUUSD",
        timeframe="5m",
        payload={"mode": "replay"},
    )
    repository.upsert_ai_trader(
        trader_id="brooks-generalist",
        name="Brooks Generalist",
        payload={"status": "active"},
    )
    agent_run_id = repository.record_agent_run(
        session_id=session_id,
        trader_id="brooks-generalist",
        payload={"bias": "long"},
    )
    action_id = repository.record_agent_action(
        analysis_run_id=agent_run_id,
        sequence=1,
        tool="find_swings",
        payload={"tool": "find_swings", "status": "ok"},
    )
    model_call_id = repository.record_canonical_model_call(
        agent_run_id=agent_run_id,
        provider="mock",
        model="mock-brooks",
        input_tokens=100,
        output_tokens=50,
        estimated_cost_usd=0,
        payload={"schema_version": "v1"},
    )
    repository.record_chart_object(
        object_id="tl-primary",
        agent_run_id=agent_run_id,
        payload={"kind": "trendline"},
    )
    repository.record_simulated_order(
        order_id="sim-order-1",
        agent_run_id=agent_run_id,
        payload={"status": "filled"},
    )
    trade_id = repository.record_simulated_trade(
        order_id="sim-order-1",
        payload={"r_multiple": 2.0},
    )
    review_id = repository.record_trade_review(
        agent_run_id=agent_run_id,
        trade_id=trade_id,
        payload={"review": "target reached"},
    )
    repository.record_knowledge_source(
        source_id="brooks-trends",
        title="Reading Price Charts Bar by Bar",
        payload={"themes": ["trend"]},
    )
    repository.record_knowledge_chunk(
        source_id="brooks-trends",
        chunk_key="trend/chapter-1",
        payload={"summary": "trend context"},
    )
    repository.record_setup_dossier(
        dossier_key="wedge-reversal",
        payload={"name": "Wedge reversal"},
    )

    assert session_id > 0
    assert agent_run_id > 0
    assert action_id > 0
    assert model_call_id > 0
    assert trade_id > 0
    assert review_id > 0
    for table_name in [
        "instruments",
        "sessions",
        "ai_traders",
        "agent_runs",
        "agent_actions",
        "model_calls",
        "chart_objects",
        "simulated_orders",
        "simulated_trades",
        "trade_reviews",
        "knowledge_sources",
        "knowledge_chunks",
        "setup_dossiers",
    ]:
        assert repository.count_rows(table_name) == 1
