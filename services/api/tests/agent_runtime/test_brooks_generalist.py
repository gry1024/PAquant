import pytest
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
        "chain-of-thought" not in action.observation.lower() for action in decision.action_stream
    )
    assert "chain-of-thought" not in decision.reasoning_summary.lower()
    assert decision.proposed_order is not None
    assert decision.proposed_order.order_type == "stop"
    assert decision.proposed_order.activation_price == decision.proposed_order.entry
    assert decision.proposed_order.execution_plan.signal_bar_index >= 0
    assert decision.proposed_order.execution_plan.trigger_price == decision.proposed_order.entry
    assert "信号K线" in decision.proposed_order.execution_plan.signal_bar_pattern
    assert "stop order" in decision.proposed_order.execution_plan.entry_tactic
    assert any(
        decision.proposed_order.execution_plan.trigger_condition in level.evidence
        for level in decision.key_levels
    )


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
    assert "must call at least one drawing tool" in provider.request.prompt
    assert "Recent candles" in provider.request.prompt
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


def test_brooks_generalist_rejects_real_provider_without_tool_calls():
    class NoToolProvider:
        def generate(self, request: ModelRequest) -> ModelResponse:
            return ModelResponse(
                text="Analysis text without tool calls.",
                structured={},
                tool_calls=[],
                usage=ModelUsage(
                    provider="deepseek",
                    model="deepseek-chat",
                    input_tokens=20,
                    output_tokens=10,
                    estimated_cost_usd=0.00002,
                ),
            )

    trader = BrooksGeneralistTrader(provider=NoToolProvider())

    with pytest.raises(ValueError, match="tool calls"):
        trader.analyze(
            candles=load_sample_candles(),
            knowledge=compile_core_knowledge(),
            chart_objects=[],
        )


def test_brooks_generalist_forces_drawing_and_measurement_when_real_provider_under_calls():
    class UnderCallingProvider:
        def __init__(self) -> None:
            self.requests: list[ModelRequest] = []

        def generate(self, request: ModelRequest) -> ModelResponse:
            self.requests.append(request)
            tool_choice = request.metadata.get("tool_choice")
            if tool_choice == {
                "type": "function",
                "function": {"name": "draw_trendline"},
            }:
                tool_calls = [
                    ModelToolCall(
                        id="forced-draw",
                        name="draw_trendline",
                        arguments={
                            "id": "model-live-trendline",
                            "label": "Model live trend line",
                            "start": {"time_index": 0, "price": 2306.5},
                            "end": {"time_index": 40, "price": 2329.0},
                        },
                    )
                ]
            elif tool_choice == {
                "type": "function",
                "function": {"name": "measure_leg"},
            }:
                tool_calls = [
                    ModelToolCall(
                        id="forced-measure",
                        name="measure_leg",
                        arguments={
                            "start": {"time_index": 0, "price": 2307.8},
                            "end": {"time_index": 20, "price": 2320.6},
                        },
                    )
                ]
            else:
                tool_calls = [
                    ModelToolCall(
                        id="first-call",
                        name="find_swings",
                        arguments={
                            "left_strength": 2,
                            "right_strength": 2,
                            "limit": 8,
                        },
                    )
                ]
            return ModelResponse(
                text="Model response",
                structured={},
                tool_calls=tool_calls,
                usage=ModelUsage(
                    provider="deepseek",
                    model="deepseek-chat",
                    input_tokens=10,
                    output_tokens=5,
                    estimated_cost_usd=0.00001,
                ),
            )

    provider = UnderCallingProvider()
    decision = BrooksGeneralistTrader(provider=provider).analyze(
        candles=load_sample_candles(),
        knowledge=compile_core_knowledge(),
        chart_objects=[],
    )

    assert len(provider.requests) == 3
    assert [action.tool for action in decision.action_stream[:3]] == [
        "find_swings",
        "draw_trendline",
        "measure_leg",
    ]
    assert decision.action_stream[1].chart_object_id == "model-live-trendline"
    assert decision.model_usage.input_tokens == 30


def test_brooks_generalist_order_prices_follow_candle_data_not_constants():
    base_decision = BrooksGeneralistTrader().analyze(
        candles=load_sample_candles(),
        knowledge=compile_core_knowledge(),
        chart_objects=[],
    )
    shifted_candles = [
        candle.model_copy(
            update={
                "open": candle.open + 100,
                "high": candle.high + 100,
                "low": candle.low + 100,
                "close": candle.close + 100,
            }
        )
        for candle in load_sample_candles()
    ]

    shifted_decision = BrooksGeneralistTrader().analyze(
        candles=shifted_candles,
        knowledge=compile_core_knowledge(),
        chart_objects=[],
    )

    assert base_decision.proposed_order is not None
    assert shifted_decision.proposed_order is not None
    assert shifted_decision.proposed_order.entry == pytest.approx(
        base_decision.proposed_order.entry + 100
    )
    assert shifted_decision.proposed_order.stop == pytest.approx(
        base_decision.proposed_order.stop + 100
    )
    assert shifted_decision.proposed_order.target == pytest.approx(
        base_decision.proposed_order.target + 100
    )
    assert shifted_decision.proposed_order.activation_price == pytest.approx(
        base_decision.proposed_order.activation_price + 100
    )
    assert (
        shifted_decision.proposed_order.execution_plan.signal_bar_index
        == base_decision.proposed_order.execution_plan.signal_bar_index
    )
