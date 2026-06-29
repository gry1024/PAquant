from __future__ import annotations

import csv
import urllib.request
from collections.abc import Iterable
from io import StringIO
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field

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


class TextTransport(Protocol):
    def fetch_text(self, url: str, *, timeout: float) -> str: ...


class CsvDownloadSource(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    url: str
    symbol: str
    timeframe: str = "5m"
    timeout_seconds: float = Field(default=30, gt=0)


class UrllibTextTransport:
    def fetch_text(self, url: str, *, timeout: float) -> str:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return response.read().decode("utf-8")


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


class RemoteCsvHistoricalDataProvider:
    def __init__(
        self,
        *,
        source: CsvDownloadSource,
        cache_path: Path,
        transport: TextTransport | None = None,
    ) -> None:
        self.source = source
        self.cache_path = cache_path
        self.transport = transport or UrllibTextTransport()

    def load_candles(self, symbol: str, timeframe: str) -> list[Candle]:
        normalized_symbol = normalize_instrument_symbol(symbol)
        if timeframe != self.source.timeframe:
            raise ValueError(f"source {self.source.name} supports {self.source.timeframe} only")
        text = self.refresh_cache(force=False)
        candles = parse_ohlcv_csv(text, symbol=self.source.symbol, timeframe=self.source.timeframe)
        return [candle for candle in candles if candle.symbol == normalized_symbol]

    def refresh_cache(self, *, force: bool = False) -> str:
        if self.cache_path.exists() and not force:
            return self.cache_path.read_text(encoding="utf-8")
        text = self.transport.fetch_text(
            self.source.url,
            timeout=self.source.timeout_seconds,
        )
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(text, encoding="utf-8")
        return text


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
