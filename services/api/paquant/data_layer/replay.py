from __future__ import annotations

from collections.abc import Sequence

from paquant.data_layer.schemas import Candle


class ReplaySession:
    def __init__(self, candles: Sequence[Candle]) -> None:
        self._candles = list(candles)
        self.cursor = 0

    def next(self, count: int) -> list[Candle]:
        if count <= 0:
            return []
        start = self.cursor
        end = min(len(self._candles), start + count)
        self.cursor = end
        return self._candles[start:end]
