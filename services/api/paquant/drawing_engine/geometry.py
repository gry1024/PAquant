from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

from paquant.drawing_engine.schemas import AnchorPoint


class LegMeasurement(BaseModel):
    model_config = ConfigDict(frozen=True)

    points: float
    bars: int
    direction: Literal["up", "down", "flat"]


def line_value_at(start: AnchorPoint, end: AnchorPoint, time_index: int) -> float:
    if end.time_index == start.time_index:
        return start.price
    slope = (end.price - start.price) / (end.time_index - start.time_index)
    return start.price + slope * (time_index - start.time_index)


def measure_leg(start: AnchorPoint, end: AnchorPoint) -> LegMeasurement:
    delta = end.price - start.price
    if delta > 0:
        direction: Literal["up", "down", "flat"] = "up"
    elif delta < 0:
        direction = "down"
    else:
        direction = "flat"
    return LegMeasurement(
        points=abs(delta), bars=abs(end.time_index - start.time_index), direction=direction
    )


def build_fibonacci_levels(
    start: AnchorPoint,
    end: AnchorPoint,
    ratios: tuple[float, ...] = (0.382, 0.5, 0.618, 1.0, 1.618),
) -> dict[str, float]:
    move = end.price - start.price
    return {f"{ratio:.3f}": round(end.price - move * ratio, 4) for ratio in ratios}
