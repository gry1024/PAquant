from paquant.agent_runtime.brooks_generalist import BrooksGeneralistTrader
from paquant.data_layer.sample_data import load_sample_candles
from paquant.knowledge_layer.compiler import compile_core_knowledge


def test_brooks_generalist_returns_structured_auditable_decision():
    trader = BrooksGeneralistTrader()

    decision = trader.analyze(
        candles=load_sample_candles(),
        knowledge=compile_core_knowledge(),
        chart_objects=[],
    )

    assert decision.market_context
    assert decision.always_in_bias in {"long", "short", "neutral"}
    assert decision.key_levels
    assert decision.invalidation
    assert 0 <= decision.confidence <= 1
    assert decision.reasoning_summary
    assert decision.knowledge_refs
    assert all(reference.source_refs for reference in decision.knowledge_refs)
    assert decision.evidence_trail
    assert decision.action_stream
    assert {"find_swings", "draw_trendline", "draw_channel", "measure_deviation"} <= {
        action.tool for action in decision.action_stream
    }
    assert any(action.chart_object_id for action in decision.action_stream)
    assert all(
        "chain-of-thought" not in action.observation.lower()
        for action in decision.action_stream
    )
    assert "chain-of-thought" not in decision.reasoning_summary.lower()
