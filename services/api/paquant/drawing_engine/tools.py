from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from paquant.data_layer.schemas import Candle
from paquant.drawing_engine.geometry import (
    build_fibonacci_levels,
    line_value_at,
    measure_leg,
)
from paquant.drawing_engine.schemas import (
    AnchorPoint,
    Channel,
    ChartObject,
    Fibonacci,
    RangeBox,
    TrendLine,
)

ToolName = Literal[
    "find_swings",
    "draw_trendline",
    "draw_channel",
    "draw_box",
    "draw_fibonacci",
    "measure_leg",
    "compare_legs",
    "count_bars",
    "project_line",
    "measure_deviation",
    "snap_to_swing",
]

REQUIRED_BROOKS_TOOL_NAMES: set[str] = {
    "find_swings",
    "draw_trendline",
    "draw_channel",
    "draw_box",
    "draw_fibonacci",
    "measure_leg",
    "compare_legs",
    "count_bars",
    "project_line",
    "measure_deviation",
    "snap_to_swing",
}

MAX_MODEL_DRAWING_BARS = 72


class ToolCommand(BaseModel):
    model_config = ConfigDict(frozen=True)

    tool: ToolName
    arguments: dict[str, Any] = Field(default_factory=dict)


class AgentAction(BaseModel):
    model_config = ConfigDict(frozen=True)

    sequence: int
    tool: ToolName
    status: Literal["ok"] = "ok"
    observation: str
    arguments: dict[str, Any]
    output: dict[str, Any]
    chart_object_id: str | None = None


class DrawingPlanResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    actions: list[AgentAction]
    chart_objects: list[ChartObject]


def execute_drawing_plan(
    candles: list[Candle],
    commands: list[ToolCommand],
) -> DrawingPlanResult:
    if not candles:
        raise ValueError("candles are required")

    chart_objects: list[ChartObject] = []
    object_index: dict[str, ChartObject] = {}
    actions: list[AgentAction] = []

    for sequence, command in enumerate(commands, start=1):
        output, observation, chart_object = _execute_command(
            candles=candles,
            command=command,
            object_index=object_index,
        )
        if chart_object is not None:
            chart_objects.append(chart_object)
            object_index[chart_object.id] = chart_object

        actions.append(
            AgentAction(
                sequence=sequence,
                tool=command.tool,
                observation=observation,
                arguments=command.arguments,
                output=output,
                chart_object_id=chart_object.id if chart_object is not None else None,
            )
        )

    return DrawingPlanResult(actions=actions, chart_objects=chart_objects)


def _execute_command(
    *,
    candles: list[Candle],
    command: ToolCommand,
    object_index: dict[str, ChartObject],
) -> tuple[dict[str, Any], str, ChartObject | None]:
    args = command.arguments
    if command.tool == "find_swings":
        swings = _find_swings(
            candles,
            left_strength=int(args.get("left_strength", 2)),
            right_strength=int(args.get("right_strength", 2)),
            limit=args.get("limit"),
        )
        return {"swings": swings}, f"Found {len(swings)} local swing points.", None

    if command.tool == "snap_to_swing":
        snap = _snap_to_swing(
            candles,
            time_index=int(args["time_index"]),
            price=float(args["price"]),
            side=args.get("side"),
        )
        return snap, f"Snapped probe to nearest {snap['kind']} swing.", None

    if command.tool == "draw_trendline":
        start, end = _bounded_anchor_pair(
            _anchor(args["start"]),
            _anchor(args["end"]),
        )
        chart_object = TrendLine(
            id=str(args["id"]),
            label=str(args["label"]),
            anchors=[start, end],
            reason=str(args.get("reason") or "趋势线用于限定当前价格行为观察区间。"),
        )
        return (
            {"chart_object": chart_object.model_dump(mode="json")},
            f"Drew trend line {chart_object.label}.",
            chart_object,
        )

    if command.tool == "draw_channel":
        base_id = str(args["base_id"])
        base = object_index.get(base_id)
        if not isinstance(base, TrendLine):
            raise ValueError(f"draw_channel requires existing trend line base_id={base_id}")
        chart_object = Channel(
            id=str(args["id"]),
            label=str(args["label"]),
            base=base,
            parallel_anchor=_anchor(args["parallel_anchor"]),
            reason=str(args.get("reason") or "通道用于衡量价格相对趋势线的过冲、欠冲和回调质量。"),
        )
        return (
            {"chart_object": chart_object.model_dump(mode="json")},
            f"Projected channel from base trend line {base_id}.",
            chart_object,
        )

    if command.tool == "draw_box":
        chart_object = RangeBox(
            id=str(args["id"]),
            label=str(args["label"]),
            start_index=int(args["start_index"]),
            end_index=int(args["end_index"]),
            high=float(args["high"]),
            low=float(args["low"]),
            reason=str(args.get("reason") or "箱体用于限定回调或交易区间的时间和价格边界。"),
        )
        return (
            {"chart_object": chart_object.model_dump(mode="json")},
            f"Marked range box {chart_object.label}.",
            chart_object,
        )

    if command.tool == "draw_fibonacci":
        start, end = _bounded_anchor_pair(_anchor(args["start"]), _anchor(args["end"]))
        chart_object = Fibonacci(
            id=str(args["id"]),
            label=str(args["label"]),
            start=start,
            end=end,
            levels=build_fibonacci_levels(start, end),
            reason=str(args.get("reason") or "斐波那契只用于所选摆动腿的回撤测量。"),
        )
        return (
            {"chart_object": chart_object.model_dump(mode="json")},
            f"Mapped Fibonacci levels for {chart_object.label}.",
            chart_object,
        )

    if command.tool == "measure_leg":
        measurement = measure_leg(_anchor(args["start"]), _anchor(args["end"]))
        return measurement.model_dump(mode="json"), "Measured leg distance and bar count.", None

    if command.tool == "compare_legs":
        first = _measure_leg_payload(args["first"])
        second = _measure_leg_payload(args["second"])
        return (
            {
                "first": first,
                "second": second,
                "points_delta": round(second["points"] - first["points"], 4),
                "bars_delta": second["bars"] - first["bars"],
            },
            "Compared prior leg with current leg.",
            None,
        )

    if command.tool == "count_bars":
        start_index = int(args["start_index"])
        end_index = int(args["end_index"])
        bars = abs(end_index - start_index) + 1
        return (
            {"start_index": start_index, "end_index": end_index, "bars": bars},
            f"Counted {bars} bars between anchors.",
            None,
        )

    if command.tool == "project_line":
        time_index = int(args["time_index"])
        price = round(line_value_at(_anchor(args["start"]), _anchor(args["end"]), time_index), 4)
        return (
            {"time_index": time_index, "price": price},
            "Projected line value at requested bar.",
            None,
        )

    if command.tool == "measure_deviation":
        start = _anchor(args["start"])
        end = _anchor(args["end"])
        point = _anchor(args["point"])
        projected = line_value_at(start, end, point.time_index)
        signed = point.price - projected
        if signed > 0:
            direction: Literal["above", "below", "at"] = "above"
        elif signed < 0:
            direction = "below"
        else:
            direction = "at"
        return (
            {
                "time_index": point.time_index,
                "point_price": point.price,
                "line_price": round(projected, 4),
                "points": round(abs(signed), 4),
                "direction": direction,
            },
            "Measured price deviation from projected line.",
            None,
        )

    raise ValueError(f"unsupported drawing tool: {command.tool}")


def _anchor(payload: dict[str, Any]) -> AnchorPoint:
    return AnchorPoint(time_index=int(payload["time_index"]), price=float(payload["price"]))


def _bounded_anchor_pair(start: AnchorPoint, end: AnchorPoint) -> tuple[AnchorPoint, AnchorPoint]:
    span = abs(end.time_index - start.time_index)
    if span <= MAX_MODEL_DRAWING_BARS:
        return start, end

    if end.time_index >= start.time_index:
        bounded_start_index = end.time_index - MAX_MODEL_DRAWING_BARS
        return (
            AnchorPoint(
                time_index=bounded_start_index,
                price=line_value_at(start, end, bounded_start_index),
            ),
            end,
        )

    bounded_end_index = end.time_index + MAX_MODEL_DRAWING_BARS
    return (
        start,
        AnchorPoint(
            time_index=bounded_end_index,
            price=line_value_at(start, end, bounded_end_index),
        ),
    )


def _measure_leg_payload(payload: dict[str, Any]) -> dict[str, Any]:
    measurement = measure_leg(_anchor(payload["start"]), _anchor(payload["end"]))
    return measurement.model_dump(mode="json")


def _find_swings(
    candles: list[Candle],
    *,
    left_strength: int,
    right_strength: int,
    limit: Any,
) -> list[dict[str, Any]]:
    swings: list[dict[str, Any]] = []
    for index in range(left_strength, len(candles) - right_strength):
        candle = candles[index]
        left = candles[index - left_strength : index]
        right = candles[index + 1 : index + right_strength + 1]
        if candle.high >= max(item.high for item in left + right):
            swings.append(
                {
                    "kind": "high",
                    "anchor": AnchorPoint(
                        time_index=index,
                        price=candle.high,
                    ).model_dump(mode="json"),
                }
            )
        if candle.low <= min(item.low for item in left + right):
            swings.append(
                {
                    "kind": "low",
                    "anchor": AnchorPoint(
                        time_index=index,
                        price=candle.low,
                    ).model_dump(mode="json"),
                }
            )

    if limit is not None:
        return swings[: int(limit)]
    return swings


def _snap_to_swing(
    candles: list[Candle],
    *,
    time_index: int,
    price: float,
    side: Any,
) -> dict[str, Any]:
    swings = _find_swings(candles, left_strength=2, right_strength=2, limit=None)
    if side in {"high", "low"}:
        swings = [swing for swing in swings if swing["kind"] == side]
    if not swings:
        raise ValueError("no swing points available to snap")

    def score(swing: dict[str, Any]) -> float:
        anchor = swing["anchor"]
        return abs(anchor["time_index"] - time_index) + abs(anchor["price"] - price) / 10

    selected = min(swings, key=score)
    return {
        "kind": selected["kind"],
        "anchor": selected["anchor"],
        "distance": round(score(selected), 4),
    }
