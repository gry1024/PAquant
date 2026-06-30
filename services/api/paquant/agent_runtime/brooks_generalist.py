from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

from paquant.data_layer.schemas import Candle
from paquant.drawing_engine.schemas import ChartObject
from paquant.drawing_engine.tools import AgentAction, ToolCommand, execute_drawing_plan
from paquant.knowledge_layer.compiler import KnowledgeArtifact
from paquant.knowledge_layer.retrieval import (
    KnowledgeReference,
    retrieve_relevant_knowledge,
)
from paquant.model_provider.base import (
    ModelProvider,
    ModelRequest,
    ModelResponse,
    ModelToolCall,
    ModelUsage,
)
from paquant.model_provider.mock import MockModelProvider

_CHART_DRAWING_TOOLS = {"draw_trendline", "draw_box", "draw_fibonacci"}
_MEASUREMENT_TOOLS = {
    "measure_leg",
    "compare_legs",
    "count_bars",
    "project_line",
    "measure_deviation",
}


class KeyLevel(BaseModel):
    model_config = ConfigDict(frozen=True)

    label: str
    price: float
    evidence: str


class ExecutionPlan(BaseModel):
    model_config = ConfigDict(frozen=True)

    order_type_label: str
    signal_bar_index: int
    signal_bar_time: str
    signal_bar_pattern: str
    trigger_price: float
    trigger_condition: str
    entry_tactic: str


class ProposedOrder(BaseModel):
    model_config = ConfigDict(frozen=True)

    side: Literal["buy", "sell"]
    order_type: Literal["limit", "market", "stop", "stop_limit"]
    activation_price: float | None = None
    entry: float
    stop: float
    target: float
    quantity: float
    setup_name: str
    execution_plan: ExecutionPlan


class TraderDecision(BaseModel):
    model_config = ConfigDict(frozen=True)

    trader_id: str
    market_context: str
    always_in_bias: Literal["long", "short", "neutral"]
    trend_strength: str
    trading_range_state: str
    key_levels: list[KeyLevel]
    setup_candidate: str
    invalidation: str
    entry_type: str
    stop: float | None
    target: float | None
    position_size_suggestion: float
    confidence: float
    no_trade_reason: str | None
    reasoning_summary: str
    knowledge_refs: list[KnowledgeReference]
    evidence_trail: list[str]
    action_stream: list[AgentAction]
    chart_objects: list[ChartObject]
    proposed_order: ProposedOrder | None
    model_usage: ModelUsage


class BrooksGeneralistTrader:
    trader_id = "brooks-generalist"

    def __init__(self, provider: ModelProvider | None = None) -> None:
        self.provider = provider or MockModelProvider()

    def analyze(
        self,
        *,
        candles: list[Candle],
        knowledge: KnowledgeArtifact,
        chart_objects: list[object],
    ) -> TraderDecision:
        if not candles:
            raise ValueError("candles are required")

        first = candles[0]
        last = candles[-1]
        high = max(candle.high for candle in candles)
        low = min(candle.low for candle in candles)
        default_tool_commands = build_brooks_generalist_drawing_commands()
        knowledge_refs = retrieve_relevant_knowledge(
            knowledge,
            query=("always-in pullback channel trader equation failed breakout wedge three pushes"),
            limit=5,
        )
        bias: Literal["long", "short", "neutral"] = "long" if last.close > first.open else "short"
        if abs(last.close - first.open) < 2:
            bias = "neutral"

        response = self.provider.generate(
            ModelRequest(
                prompt=_build_analysis_prompt(
                    candles=candles,
                    knowledge_refs=knowledge_refs,
                    first_open=first.open,
                    last_close=last.close,
                    high=high,
                    low=low,
                ),
                schema_name="TraderDecision",
                tools=build_brooks_tool_definitions(),
                metadata={
                    "chart_objects": len(chart_objects),
                    "tool_commands": [
                        command.model_dump(mode="json") for command in default_tool_commands
                    ],
                },
            )
        )
        responses = [response]
        tool_commands = _tool_calls_to_commands(response.tool_calls)
        is_mock_provider = isinstance(self.provider, MockModelProvider)
        if not tool_commands and is_mock_provider:
            tool_commands = default_tool_commands
        if not is_mock_provider:
            if not _has_any_tool(tool_commands, _CHART_DRAWING_TOOLS):
                drawing_response = self.provider.generate(
                    _build_forced_tool_request(
                        tool_name="draw_trendline",
                        candles=candles,
                        knowledge_refs=knowledge_refs,
                    )
                )
                responses.append(drawing_response)
                tool_commands.extend(_tool_calls_to_commands(drawing_response.tool_calls))
            if not _has_any_tool(tool_commands, _MEASUREMENT_TOOLS):
                measurement_response = self.provider.generate(
                    _build_forced_tool_request(
                        tool_name="measure_leg",
                        candles=candles,
                        knowledge_refs=knowledge_refs,
                    )
                )
                responses.append(measurement_response)
                tool_commands.extend(_tool_calls_to_commands(measurement_response.tool_calls))
            response = _merge_model_responses(responses)
        if not tool_commands or (
            not is_mock_provider
            and (
                not _has_any_tool(tool_commands, _CHART_DRAWING_TOOLS)
                or not _has_any_tool(tool_commands, _MEASUREMENT_TOOLS)
            )
        ):
            raise ValueError(
                "model provider returned insufficient tool calls; live AI trader "
                "mode requires drawing and measurement tool output"
            )
        drawing_result = execute_drawing_plan(candles, tool_commands)

        if bias == "neutral":
            proposed_order = None
            setup_candidate = "No-trade: neutral range"
            entry_type = "no trade"
            stop = None
            target = None
            position_size_suggestion = 0.0
            confidence = 0.38
            no_trade_reason = (
                "Always-in direction is neutral and the replay lacks enough "
                "directional follow-through for a favorable trader's equation."
            )
        else:
            proposed_order = _build_contextual_order(candles, bias)
            setup_candidate = proposed_order.setup_name
            entry_type = proposed_order.execution_plan.entry_tactic
            stop = proposed_order.stop
            target = proposed_order.target
            position_size_suggestion = 1.0
            confidence = 0.64
            no_trade_reason = None

        key_levels = [
            KeyLevel(label="session low", price=round(low, 2), evidence="Lowest replay candle"),
            KeyLevel(label="session high", price=round(high, 2), evidence="Highest replay candle"),
        ]
        if proposed_order is not None:
            key_levels.append(
                KeyLevel(
                    label="stop order trigger",
                    price=proposed_order.entry,
                    evidence=proposed_order.execution_plan.trigger_condition,
                )
            )

        return TraderDecision(
            trader_id=self.trader_id,
            market_context=(
                "XAU 5m is replaying an upward channel with pullbacks staying "
                "above the prior swing low."
                if bias != "neutral"
                else "XAU 5m is replaying a tight neutral range with no clear always-in side."
            ),
            always_in_bias=bias,
            trend_strength=(
                "moderate trend with two-sided pullbacks"
                if bias != "neutral"
                else "weak; overlapping bars show limited directional urgency"
            ),
            trading_range_state=(
                "not a mature range; treat pullbacks as tests until a failed breakout appears"
                if bias != "neutral"
                else "active range behavior; wait for breakout follow-through "
                "or a clearer failed breakout"
            ),
            key_levels=key_levels,
            setup_candidate=setup_candidate,
            invalidation=(
                f"A break beyond {proposed_order.stop:.2f} invalidates the "
                "pullback thesis and suggests the other side regained control."
                if bias != "neutral"
                else "A strong consecutive-bar breakout with follow-through "
                "would end the no-trade premise."
            ),
            entry_type=entry_type,
            stop=stop,
            target=target,
            position_size_suggestion=position_size_suggestion,
            confidence=confidence,
            no_trade_reason=no_trade_reason,
            reasoning_summary=response.text,
            knowledge_refs=knowledge_refs,
            evidence_trail=[
                "Context checked before setup label.",
                "Always-in bias derived from replay swing direction.",
                "Model API returned tool calls that were executed by drawing tools.",
                (
                    "Retrieved Brooks refs: "
                    f"{', '.join(reference.key for reference in knowledge_refs)}."
                ),
                (
                    f"{proposed_order.execution_plan.entry_tactic}. "
                    "Trader's equation uses "
                    f"{abs(proposed_order.entry - proposed_order.stop):.2f} "
                    f"points risk for {abs(proposed_order.target - proposed_order.entry):.2f} "
                    "points reward."
                    if proposed_order is not None
                    else "No order was submitted because the context was neutral."
                ),
            ],
            action_stream=drawing_result.actions,
            chart_objects=drawing_result.chart_objects,
            proposed_order=proposed_order,
            model_usage=response.usage,
        )


def _build_analysis_prompt(
    *,
    candles: list[Candle],
    knowledge_refs: list[KnowledgeReference],
    first_open: float,
    last_close: float,
    high: float,
    low: float,
) -> str:
    recent = candles[-8:]
    recent_summary = [
        {
            "index": len(candles) - len(recent) + index,
            "open": candle.open,
            "high": candle.high,
            "low": candle.low,
            "close": candle.close,
        }
        for index, candle in enumerate(recent)
    ]
    return (
        "You are PAquant Brooks Generalist. Analyze XAUUSD 5m as a price-action "
        "trader, but use tool calls for chart work. You must call at least one "
        "drawing tool such as draw_trendline, draw_channel, draw_box, or "
        "draw_fibonacci, and at least one measurement tool such as measure_leg, "
        "compare_legs, count_bars, project_line, or measure_deviation before "
        "finalizing the trade thesis. Do not expose hidden chain-of-thought; "
        "return only a concise Simplified Chinese reasoning summary after the tool calls.\n\n"
        f"Session facts: first_open={first_open:.2f}, last_close={last_close:.2f}, "
        f"high={high:.2f}, low={low:.2f}, bars={len(candles)}.\n"
        f"Recent candles: {recent_summary}.\n"
        f"Relevant Brooks refs: {[reference.key for reference in knowledge_refs]}."
    )


def _build_forced_tool_request(
    *,
    tool_name: str,
    candles: list[Candle],
    knowledge_refs: list[KnowledgeReference],
) -> ModelRequest:
    first = candles[0]
    last = candles[-1]
    mid_index = max(1, len(candles) // 2)
    mid = candles[mid_index]
    if tool_name == "draw_trendline":
        prompt = (
            "Your previous response did not create a chart drawing. Call "
            "draw_trendline now using exactly this structure: id "
            "'model-live-trendline', label 'Model live trend line', start "
            f"{{'time_index': 0, 'price': {first.low:.2f}}}, end "
            f"{{'time_index': {len(candles) - 1}, 'price': {last.close:.2f}}}. "
            "Do not return hidden chain-of-thought."
        )
    elif tool_name == "measure_leg":
        prompt = (
            "Your previous response did not create a measurement. Call "
            "measure_leg now using exactly this structure: start "
            f"{{'time_index': 0, 'price': {first.close:.2f}}}, end "
            f"{{'time_index': {mid_index}, 'price': {mid.close:.2f}}}. "
            "Do not return hidden chain-of-thought."
        )
    else:
        raise ValueError(f"unsupported forced tool: {tool_name}")

    return ModelRequest(
        prompt=(
            f"{prompt}\nRelevant Brooks refs: {[reference.key for reference in knowledge_refs]}."
        ),
        schema_name="TraderDecision",
        tools=build_brooks_tool_definitions(),
        metadata={
            "tool_choice": {
                "type": "function",
                "function": {"name": tool_name},
            }
        },
    )


def _build_contextual_order(
    candles: list[Candle], bias: Literal["long", "short", "neutral"]
) -> ProposedOrder:
    signal_index, signal_candle = _find_signal_bar(candles, bias)
    tick = 0.1
    minimum_risk = 1.0
    quantity = 1.0

    if bias == "short":
        entry = round(signal_candle.low - tick, 2)
        stop = round(max(signal_candle.high + tick, entry + minimum_risk), 2)
        risk = round(abs(stop - entry), 2)
        target = round(entry - (risk * 2), 2)
        return ProposedOrder(
            side="sell",
            order_type="stop",
            activation_price=entry,
            entry=entry,
            stop=stop,
            target=target,
            quantity=quantity,
            setup_name="Brooks signal-bar breakout in always-in short context",
            execution_plan=_build_execution_plan(
                side="sell",
                entry=entry,
                signal_index=signal_index,
                signal_candle=signal_candle,
                trigger_side="low",
            ),
        )

    entry = round(signal_candle.high + tick, 2)
    stop = round(min(signal_candle.low - tick, entry - minimum_risk), 2)
    risk = round(abs(entry - stop), 2)
    target = round(entry + (risk * 2), 2)
    return ProposedOrder(
        side="buy",
        order_type="stop",
        activation_price=entry,
        entry=entry,
        stop=stop,
        target=target,
        quantity=quantity,
        setup_name="Brooks signal-bar breakout in always-in long context",
        execution_plan=_build_execution_plan(
            side="buy",
            entry=entry,
            signal_index=signal_index,
            signal_candle=signal_candle,
            trigger_side="high",
        ),
    )


def _find_signal_bar(
    candles: list[Candle], bias: Literal["long", "short", "neutral"]
) -> tuple[int, Candle]:
    start_index = max(0, len(candles) - 12)
    recent = candles[start_index:]

    for offset in range(len(recent) - 1, -1, -1):
        candle = recent[offset]
        if bias == "short":
            if candle.close < candle.open and candle.close_position <= 0.45:
                return start_index + offset, candle
        elif candle.close > candle.open and candle.close_position >= 0.55:
            return start_index + offset, candle

    fallback_index = len(candles) - 1
    return fallback_index, candles[fallback_index]


def _build_execution_plan(
    *,
    side: Literal["buy", "sell"],
    entry: float,
    signal_index: int,
    signal_candle: Candle,
    trigger_side: Literal["high", "low"],
) -> ExecutionPlan:
    is_buy = side == "buy"
    order_name = "buy stop" if is_buy else "sell stop"
    direction_label = "多头" if is_buy else "空头"
    trigger_verb = "突破" if is_buy else "跌破"
    signal_extreme = signal_candle.high if trigger_side == "high" else signal_candle.low
    trigger_label = "高点" if trigger_side == "high" else "低点"
    trigger_condition = (
        f"{trigger_verb}信号K线{trigger_label} {signal_extreme:.2f} 后，"
        f"以 {entry:.2f} 触发 {order_name}"
    )
    return ExecutionPlan(
        order_type_label=order_name,
        signal_bar_index=signal_index,
        signal_bar_time=signal_candle.timestamp.isoformat(),
        signal_bar_pattern=(f"{direction_label}信号K线：实体方向一致，收盘位置支持 {order_name}"),
        trigger_price=entry,
        trigger_condition=trigger_condition,
        entry_tactic=(f"{order_name} stop order，等待信号K线被触发后才入场；触发前不成交"),
    )


def _has_any_tool(commands: list[ToolCommand], tool_names: set[str]) -> bool:
    return any(command.tool in tool_names for command in commands)


def _merge_model_responses(responses: list[ModelResponse]) -> ModelResponse:
    if len(responses) == 1:
        return responses[0]

    first = responses[0]
    text = " ".join(response.text.strip() for response in responses if response.text.strip())
    if not text:
        text = (
            "Model API returned required drawing and measurement tool calls; "
            "PAquant executed them before forming the audited trade plan."
        )
    return ModelResponse(
        text=text,
        structured={
            key: value for response in responses for key, value in response.structured.items()
        },
        tool_calls=[tool_call for response in responses for tool_call in response.tool_calls],
        usage=ModelUsage(
            provider=first.usage.provider,
            model=first.usage.model,
            input_tokens=sum(response.usage.input_tokens for response in responses),
            output_tokens=sum(response.usage.output_tokens for response in responses),
            estimated_cost_usd=round(
                sum(response.usage.estimated_cost_usd for response in responses), 8
            ),
        ),
    )


def _tool_calls_to_commands(tool_calls: list[ModelToolCall]) -> list[ToolCommand]:
    commands: list[ToolCommand] = []
    for call in tool_calls:
        commands.append(ToolCommand(tool=call.name, arguments=call.arguments))
    return commands


def build_brooks_tool_definitions() -> list[dict]:
    return [
        _tool_schema(
            name="find_swings",
            description="Find local swing highs and lows in the visible candle window.",
            properties={
                "left_strength": {"type": "integer"},
                "right_strength": {"type": "integer"},
                "limit": {"type": "integer"},
            },
        ),
        _tool_schema(
            name="snap_to_swing",
            description="Snap a probe point to the nearest swing high or low.",
            properties={
                "time_index": {"type": "integer"},
                "price": {"type": "number"},
                "side": {"type": "string", "enum": ["high", "low"]},
            },
            required=["time_index", "price"],
        ),
        _tool_schema(
            name="draw_trendline",
            description="Create a trend line chart object from two anchored prices.",
            properties=_anchored_line_properties(
                extra={"id": {"type": "string"}, "label": {"type": "string"}}
            ),
            required=["id", "label", "start", "end"],
        ),
        _tool_schema(
            name="draw_channel",
            description="Create a parallel channel from an existing trend line.",
            properties={
                "id": {"type": "string"},
                "label": {"type": "string"},
                "base_id": {"type": "string"},
                "parallel_anchor": _anchor_schema(),
            },
            required=["id", "label", "base_id", "parallel_anchor"],
        ),
        _tool_schema(
            name="draw_box",
            description="Create a price range box over a candle index interval.",
            properties={
                "id": {"type": "string"},
                "label": {"type": "string"},
                "start_index": {"type": "integer"},
                "end_index": {"type": "integer"},
                "high": {"type": "number"},
                "low": {"type": "number"},
            },
            required=["id", "label", "start_index", "end_index", "high", "low"],
        ),
        _tool_schema(
            name="draw_fibonacci",
            description="Create a Fibonacci retracement map from a swing leg.",
            properties=_anchored_line_properties(
                extra={"id": {"type": "string"}, "label": {"type": "string"}}
            ),
            required=["id", "label", "start", "end"],
        ),
        _tool_schema(
            name="measure_leg",
            description="Measure points and bar count between two anchors.",
            properties=_anchored_line_properties(),
            required=["start", "end"],
        ),
        _tool_schema(
            name="compare_legs",
            description="Compare two measured legs by points and bars.",
            properties={
                "first": {
                    "type": "object",
                    "properties": _anchored_line_properties(),
                    "required": ["start", "end"],
                },
                "second": {
                    "type": "object",
                    "properties": _anchored_line_properties(),
                    "required": ["start", "end"],
                },
            },
            required=["first", "second"],
        ),
        _tool_schema(
            name="count_bars",
            description="Count bars between two candle indexes.",
            properties={
                "start_index": {"type": "integer"},
                "end_index": {"type": "integer"},
            },
            required=["start_index", "end_index"],
        ),
        _tool_schema(
            name="project_line",
            description="Project the price of a line at a future candle index.",
            properties={
                **_anchored_line_properties(),
                "time_index": {"type": "integer"},
            },
            required=["start", "end", "time_index"],
        ),
        _tool_schema(
            name="measure_deviation",
            description="Measure how far a point sits from a projected line.",
            properties={
                **_anchored_line_properties(),
                "point": _anchor_schema(),
            },
            required=["start", "end", "point"],
        ),
    ]


def _tool_schema(
    *,
    name: str,
    description: str,
    properties: dict,
    required: list[str] | None = None,
) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required or [],
            },
        },
    }


def _anchor_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "time_index": {"type": "integer"},
            "price": {"type": "number"},
        },
        "required": ["time_index", "price"],
    }


def _anchored_line_properties(*, extra: dict | None = None) -> dict:
    return {
        **(extra or {}),
        "start": _anchor_schema(),
        "end": _anchor_schema(),
    }


def build_brooks_generalist_drawing_commands() -> list[ToolCommand]:
    return [
        ToolCommand(
            tool="find_swings",
            arguments={"left_strength": 2, "right_strength": 2, "limit": 8},
        ),
        ToolCommand(
            tool="snap_to_swing",
            arguments={"time_index": 9, "price": 2311.4, "side": "low"},
        ),
        ToolCommand(
            tool="draw_trendline",
            arguments={
                "id": "tl-primary",
                "label": "Always-in long trend line",
                "start": {"time_index": 0, "price": 2306.5},
                "end": {"time_index": 40, "price": 2329.0},
            },
        ),
        ToolCommand(
            tool="draw_channel",
            arguments={
                "id": "channel-primary",
                "label": "Parallel channel projection",
                "base_id": "tl-primary",
                "parallel_anchor": {"time_index": 17, "price": 2322.4},
            },
        ),
        ToolCommand(
            tool="draw_box",
            arguments={
                "id": "box-pullback",
                "label": "Early pullback box",
                "start_index": 0,
                "end_index": 12,
                "high": 2316.0,
                "low": 2306.5,
            },
        ),
        ToolCommand(
            tool="draw_fibonacci",
            arguments={
                "id": "fib-swing",
                "label": "Swing retracement map",
                "start": {"time_index": 0, "price": 2306.5},
                "end": {"time_index": 24, "price": 2325.2},
            },
        ),
        ToolCommand(
            tool="measure_leg",
            arguments={
                "start": {"time_index": 4, "price": 2310.0},
                "end": {"time_index": 18, "price": 2320.0},
            },
        ),
        ToolCommand(
            tool="compare_legs",
            arguments={
                "first": {
                    "start": {"time_index": 4, "price": 2310.0},
                    "end": {"time_index": 18, "price": 2320.0},
                },
                "second": {
                    "start": {"time_index": 20, "price": 2315.0},
                    "end": {"time_index": 29, "price": 2326.9},
                },
            },
        ),
        ToolCommand(tool="count_bars", arguments={"start_index": 8, "end_index": 17}),
        ToolCommand(
            tool="project_line",
            arguments={
                "start": {"time_index": 0, "price": 2306.5},
                "end": {"time_index": 40, "price": 2329.0},
                "time_index": 60,
            },
        ),
        ToolCommand(
            tool="measure_deviation",
            arguments={
                "start": {"time_index": 0, "price": 2306.5},
                "end": {"time_index": 40, "price": 2329.0},
                "point": {"time_index": 29, "price": 2326.9},
            },
        ),
    ]
