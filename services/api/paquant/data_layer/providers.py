from __future__ import annotations

import csv
from collections.abc import Iterable
from io import StringIO
from typing import Protocol

from paquant.data_layer.schemas import Candle

_XAU_SYMBOL_ALIASES = {
    "XAUUSD",
    "XAUUSDC",
    "XAU/USD",
    "GOLD",
}


class HistoricalDataProvider(Protocol):
    def load_candles(self, symbol: str, timeframe: str) -> list[Candle]:
        """Load normalized historical candles for replay."""


class InMemoryHistoricalDataProvider:
    def __init__(self, candles: Iterable[Candle]) -> None:
        self._candles = sorted(candles, key=lambda candle: candle.timestamp)

    def load_candles(self, symbol: str, timeframe: str) -> list[Candle]:
        normalized_symbol = normalize_instrument_symbol(symbol)
        if timeframe != "5m":
            raise ValueError("phase one supports 5m data only")
        return [
            candle
            for candle in self._candles
            if candle.symbol == normalized_symbol and candle.timeframe == timeframe
        ]


def normalize_instrument_symbol(value: str) -> str:
    normalized = value.strip().upper().replace(" ", "")
    if normalized in _XAU_SYMBOL_ALIASES:
        return "XAUUSD"
    raise ValueError(f"unsupported instrument symbol: {value}")


def parse_ohlcv_csv(text: str, *, symbol: str, timeframe: str = "5m") -> list[Candle]:
    if timeframe != "5m":
        raise ValueError("phase one supports 5m data only")
    normalized_symbol = normalize_instrument_symbol(symbol)
    reader = csv.DictReader(StringIO(text.strip()))
    candles = [
        Candle(
            timestamp=_required(row, "timestamp"),
            symbol=normalized_symbol,
            timeframe=timeframe,
            open=float(_required(row, "open")),
            high=float(_required(row, "high")),
            low=float(_required(row, "low")),
            close=float(_required(row, "close")),
            volume=float(_required(row, "volume")),
        )
        for row in reader
    ]
    return sorted(candles, key=lambda candle: candle.timestamp)


def _required(row: dict[str, str | None], key: str) -> str:
    value = row.get(key)
    if value is None or value == "":
        raise ValueError(f"CSV row is missing required field: {key}")
    return value
