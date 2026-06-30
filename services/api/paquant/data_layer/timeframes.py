from __future__ import annotations

from collections.abc import Sequence
from typing import Literal

from pydantic import BaseModel, ConfigDict

from paquant.data_layer.schemas import Candle


class HigherTimeframeContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    timeframe: Literal["15m", "1h"]
    bars: int
    bias: Literal["long", "short", "neutral"]
    high: float
    low: float
    last_close: float
    summary: str


def build_higher_timeframe_context(
    candles: Sequence[Candle],
) -> list[HigherTimeframeContext]:
    ordered = sorted(candles, key=lambda candle: candle.timestamp)
    return [
        _build_context(ordered, timeframe="15m", group_size=3),
        _build_context(ordered, timeframe="1h", group_size=12),
    ]


def _build_context(
    candles: Sequence[Candle],
    *,
    timeframe: Literal["15m", "1h"],
    group_size: int,
) -> HigherTimeframeContext:
    if not candles:
        raise ValueError("candles are required for higher timeframe context")
    grouped = [
        candles[index : index + group_size]
        for index in range(0, len(candles), group_size)
        if len(candles[index : index + group_size]) == group_size
    ]
    if not grouped:
        raise ValueError(f"not enough 5m candles to derive {timeframe} context")

    first_open = grouped[0][0].open
    last_close = grouped[-1][-1].close
    high = max(candle.high for group in grouped for candle in group)
    low = min(candle.low for group in grouped for candle in group)
    bias = _bias(first_open=first_open, last_close=last_close)
    display_name = "M15" if timeframe == "15m" else "H1"
    return HigherTimeframeContext(
        timeframe=timeframe,
        bars=len(grouped),
        bias=bias,
        high=round(high, 2),
        low=round(low, 2),
        last_close=round(last_close, 2),
        summary=(
            f"{display_name} {bias} context derived from XAU 5m replay; range {low:.2f}-{high:.2f}."
        ),
    )


def _bias(*, first_open: float, last_close: float) -> Literal["long", "short", "neutral"]:
    difference = last_close - first_open
    if abs(difference) < 1:
        return "neutral"
    if difference > 0:
        return "long"
    return "short"
