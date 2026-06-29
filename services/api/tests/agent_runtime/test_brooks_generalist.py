from paquant.agent_runtime.brooks_generalist import BrooksGeneralistTrader
from paquant.data_layer.sample_data import load_sample_candles
from paquant.data_layer.schemas import Candle
from paquant.knowledge_layer.compiler import compile_core_knowledge
from paquant.model_provider.base import (
    ModelRequest,
    ModelResponse,
    ModelToolCall,
    ModelUsage,
)


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


def test_brooks_generalist_can_return_no_trade_for_neutral_context():
    trader = BrooksGeneralistTrader()
    candles = [
        Candle(
            timestamp=f"2026-06-30T00:{index:02d}:00Z",
            symbol="XAUUSD",
            timeframe="5m",
            open=2300.0,
            high=2301.0,
            low=2299.0,
            close=2300.2,
            volume=100,
        )
        for index in range(12)
    ]

    decision = trader.analyze(
        candles=candles,
        knowledge=compile_core_knowledge(),
        chart_objects=[],
    )

    assert decision.always_in_bias == "neutral"
    assert decision.proposed_order is None
    assert decision.no_trade_reason
    assert decision.position_size_suggestion == 0


def test_brooks_generalist_executes_model_tool_calls_instead_of_static_drawings():
    class ToolCallingProvider:
        def __init__(self) -> None:
            self.request: ModelRequest | None = None

        def generate(self, request: ModelRequest) -> ModelResponse:
            self.request = request
            return ModelResponse(
                text="Model formed a pullback thesis after drawing a support line.",
                structured={"bias": "long"},
                tool_calls=[
                    ModelToolCall(
                        id="tool-call-1",
                        name="draw_trendline",
                        arguments={
                            "id": "model-support-line",
                            "label": "Model support line",
                            "start": {"time_index": 0, "price": 2306.5},
                            "end": {"time_index": 12, "price": 2314.0},
                        },
                    ),
                    ModelToolCall(
                        id="tool-call-2",
                        name="measure_leg",
                        arguments={
                            "start": {"time_index": 4, "price": 2310.0},
                            "end": {"time_index": 18, "price": 2320.0},
                        },
                    ),
                ],
                usage=ModelUsage(
                    provider="deepseek",
                    model="deepseek-chat",
                    input_tokens=100,
                    output_tokens=50,
                    estimated_cost_usd=0.000082,
                ),
            )

    provider = ToolCallingProvider()
    trader = BrooksGeneralistTrader(provider=provider)

    decision = trader.analyze(
        candles=load_sample_candles(),
        knowledge=compile_core_knowledge(),
        chart_objects=[],
    )

    assert provider.request is not None
    assert provider.request.tools
    assert {tool["function"]["name"] for tool in provider.request.tools} >= {
        "draw_trendline",
        "measure_leg",
    }
    assert [action.tool for action in decision.action_stream] == [
        "draw_trendline",
        "measure_leg",
    ]
    assert decision.action_stream[0].chart_object_id == "model-support-line"
    assert decision.model_usage.provider == "deepseek"
