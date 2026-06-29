from __future__ import annotations

from datetime import UTC, datetime, timedelta

from paquant.data_layer.schemas import Candle


def _close_for_index(index: int) -> float:
    trend = 2309.4 + index * 0.54
    pullback = [0.0, 1.0, 1.7, 0.5, -0.4, 0.9, 1.5, 0.2][index % 8]
    if index in {9, 10, 11}:
        pullback -= 1.8
    if index in {17, 18, 19}:
        pullback += 1.8
    return round(trend + pullback, 2)


def load_sample_candles() -> list[Candle]:
    """Return deterministic XAUUSD 5m candles for replay and tests."""
    start = datetime(2026, 6, 30, 0, 0, tzinfo=UTC)
    candles: list[Candle] = []
    previous_close = 2308.0

    for index in range(72):
        close = _close_for_index(index)
        open_price = previous_close
        high = round(max(open_price, close) + 1.25 + (index % 3) * 0.15, 2)
        low = round(min(open_price, close) - 1.25 - (index % 4) * 0.1, 2)
        if index == 0:
            low = 2306.5
            high = 2312.45
        candles.append(
            Candle(
                timestamp=start + timedelta(minutes=5 * index),
                symbol="XAUUSD",
                timeframe="5m",
                open=open_price,
                high=high,
                low=low,
                close=close,
                volume=800 + index * 7,
            )
        )
        previous_close = close

    return candles
