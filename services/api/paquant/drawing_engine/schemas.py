from __future__ import annotations

from typing import Annotated, Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter


class AnchorPoint(BaseModel):
    model_config = ConfigDict(frozen=True)

    time_index: int
    price: float


class TrendLine(BaseModel):
    model_config = ConfigDict(frozen=True)

    kind: Literal["trendline"] = "trendline"
    id: str
    label: str
    anchors: list[AnchorPoint] = Field(min_length=2, max_length=2)


class Channel(BaseModel):
    model_config = ConfigDict(frozen=True)

    kind: Literal["channel"] = "channel"
    id: str
    label: str
    base: TrendLine
    parallel_anchor: AnchorPoint


class RangeBox(BaseModel):
    model_config = ConfigDict(frozen=True)

    kind: Literal["range_box"] = "range_box"
    id: str
    label: str
    start_index: int
    end_index: int
    high: float
    low: float


class Fibonacci(BaseModel):
    model_config = ConfigDict(frozen=True)

    kind: Literal["fibonacci"] = "fibonacci"
    id: str
    label: str
    start: AnchorPoint
    end: AnchorPoint
    levels: dict[str, float]


class MeasuredMove(BaseModel):
    model_config = ConfigDict(frozen=True)

    kind: Literal["measured_move"] = "measured_move"
    id: str
    label: str
    start: AnchorPoint
    end: AnchorPoint
    projected_from: AnchorPoint
    target_price: float


class ThreePush(BaseModel):
    model_config = ConfigDict(frozen=True)

    kind: Literal["three_push"] = "three_push"
    id: str
    label: str
    pushes: list[AnchorPoint] = Field(min_length=3)


class TradeMarker(BaseModel):
    model_config = ConfigDict(frozen=True)

    kind: Literal["trade_marker"] = "trade_marker"
    id: str
    label: str
    time_index: int
    price: float
    marker_type: Literal["entry", "stop", "target", "fill"]
    quantity: float | None = None
    reason: str | None = None


ChartObject: TypeAlias = Annotated[
    TrendLine | Channel | RangeBox | Fibonacci | MeasuredMove | ThreePush | TradeMarker,
    Field(discriminator="kind"),
]

_chart_object_adapter = TypeAdapter(ChartObject)


def deserialize_chart_object(payload: dict) -> ChartObject:
    return _chart_object_adapter.validate_python(payload)


def serialize_chart_object(chart_object: ChartObject) -> dict:
    return chart_object.model_dump(mode="json")
