from __future__ import annotations

import csv
import json
import os
import urllib.error
import urllib.request
from collections.abc import Iterable
from datetime import UTC, datetime
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


class JsonTransport(Protocol):
    def fetch_json(self, url: str, *, timeout: float) -> dict: ...


class CsvDownloadSource(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    url: str
    symbol: str
    timeframe: str = "5m"
    timeout_seconds: float = Field(default=30, gt=0)


class LiveMarketSource(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    id: str
    label: str
    instrument_symbol: str = Field(alias="instrumentSymbol")
    instrument_kind: str = Field(alias="instrumentKind")
    is_spot: bool = Field(alias="isSpot")
    is_mock: bool = Field(alias="isMock")
    latency: str


class LiveMarketQuote(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    symbol: str
    price: float
    timestamp: datetime
    provider_symbol: str = Field(alias="providerSymbol")
    bid: float | None = None
    ask: float | None = None


class LiveMarketFeed(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    source: LiveMarketSource
    quote: LiveMarketQuote
    candles: list[Candle]


class UrllibTextTransport:
    def fetch_text(self, url: str, *, timeout: float) -> str:
        with _urlopen_with_local_proxy_fallback(url, timeout=timeout) as response:
            return response.read().decode("utf-8")


class UrllibJsonTransport:
    def fetch_json(self, url: str, *, timeout: float) -> dict:
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "PAquant/0.1 (+https://github.com/gry1024/PAquant)"},
        )
        with _urlopen_with_local_proxy_fallback(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))


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


class YahooGoldFuturesChartProvider:
    """Near-real-time GC futures proxy; never presented as spot XAUUSD."""

    def __init__(
        self,
        *,
        transport: JsonTransport | None = None,
        timeout_seconds: float = 6,
    ) -> None:
        self.transport = transport or UrllibJsonTransport()
        self.timeout_seconds = timeout_seconds

    def load_candles(self, symbol: str, timeframe: str) -> LiveMarketFeed:
        normalized_symbol = normalize_instrument_symbol(symbol)
        if timeframe != "5m":
            raise ValueError("live market provider supports 5m data only")
        raw = self.transport.fetch_json(
            "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=5m",
            timeout=self.timeout_seconds,
        )
        result = _first_chart_result(raw)
        meta = result.get("meta") or {}
        timestamps = result.get("timestamp") or []
        quote_rows = ((result.get("indicators") or {}).get("quote") or [{}])[0]
        candles = _parse_yahoo_chart_candles(
            timestamps=timestamps,
            quote_rows=quote_rows,
            symbol=normalized_symbol,
        )
        if not candles:
            raise ValueError("Yahoo GC=F response did not contain 5m candles")
        quote_time = _epoch_to_datetime(int(meta.get("regularMarketTime") or timestamps[-1]))
        price = float(meta.get("regularMarketPrice") or candles[-1].close)
        return LiveMarketFeed(
            source=LiveMarketSource(
                id="yahoo_gc_futures_proxy",
                label="Yahoo Finance GC=F COMEX gold futures proxy",
                instrument_symbol="GC=F",
                instrument_kind="futures_proxy",
                is_spot=False,
                is_mock=False,
                latency="near_realtime",
            ),
            quote=LiveMarketQuote(
                symbol=normalized_symbol,
                price=price,
                timestamp=quote_time,
                provider_symbol=str(meta.get("symbol") or "GC=F"),
            ),
            candles=candles,
        )


class MT5HistoricalDataProvider:
    """Read closed XAU 5-minute bars from a running MetaTrader 5 terminal.

    The implementation follows the PA_Agent MT5 snapshot semantics:
    ``copy_rates_from_pos(symbol, timeframe, 0, n + 1)`` returns an oldest-first
    array whose last row is the current forming bar. Phase-one AI analysis uses
    closed candles only, so the forming row is skipped.
    """

    def __init__(
        self,
        *,
        mt5_module: object | None = None,
        broker_symbol: str = "XAUUSDc",
        bars: int = 240,
    ) -> None:
        self.mt5_module = mt5_module
        self.broker_symbol = broker_symbol
        self.bars = bars

    def load_candles(self, symbol: str, timeframe: str) -> list[Candle]:
        normalized_symbol = normalize_instrument_symbol(symbol)
        if timeframe != "5m":
            raise ValueError("MT5 provider supports 5m data only in phase one")
        if self.bars < 1:
            raise ValueError("MT5 provider requires at least one closed bar")

        mt5 = self.mt5_module or _import_mt5_module()
        if not mt5.initialize():
            last_error = mt5.last_error() if hasattr(mt5, "last_error") else "unknown"
            raise RuntimeError(f"MT5 initialize() failed: {last_error}")
        if hasattr(mt5, "symbol_select") and not mt5.symbol_select(self.broker_symbol, True):
            raise RuntimeError(f"MT5 symbol_select({self.broker_symbol!r}) failed")
        try:
            timeframe_const = mt5.TIMEFRAME_M5
        except AttributeError as exc:
            raise RuntimeError("MT5 TIMEFRAME_M5 constant is unavailable") from exc

        rates = mt5.copy_rates_from_pos(self.broker_symbol, timeframe_const, 0, self.bars + 1)
        if rates is None or len(rates) == 0:
            last_error = mt5.last_error() if hasattr(mt5, "last_error") else "unknown"
            raise RuntimeError(f"MT5 copy_rates_from_pos failed: {last_error}")

        rows = list(rates)
        closed_rows = rows[:-1] if len(rows) > self.bars else rows
        selected_rows = closed_rows[-self.bars :]
        return [
            _mt5_rate_to_candle(row, symbol=normalized_symbol, timeframe=timeframe)
            for row in selected_rows
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


def _first_chart_result(raw: dict) -> dict:
    chart = raw.get("chart") or {}
    error = chart.get("error")
    if error:
        raise ValueError(f"Yahoo chart error: {error}")
    results = chart.get("result") or []
    if not results:
        raise ValueError("Yahoo chart response missing result")
    return results[0]


def _urlopen_with_local_proxy_fallback(
    request: str | urllib.request.Request,
    *,
    timeout: float,
):
    try:
        return urllib.request.urlopen(request, timeout=timeout)
    except urllib.error.URLError:
        if not _uses_local_proxy_env():
            raise
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        return opener.open(_clone_request(request), timeout=timeout)


def _uses_local_proxy_env() -> bool:
    for key in ("HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "https_proxy", "http_proxy", "all_proxy"):
        value = os.environ.get(key, "")
        if "127.0.0.1" in value or "localhost" in value:
            return True
    return False


def _clone_request(request: str | urllib.request.Request) -> str | urllib.request.Request:
    if isinstance(request, str):
        return request
    return urllib.request.Request(
        request.full_url,
        data=request.data,
        headers=dict(request.header_items()),
        method=request.get_method(),
    )


def _parse_yahoo_chart_candles(
    *,
    timestamps: list[int],
    quote_rows: dict,
    symbol: str,
) -> list[Candle]:
    opens = quote_rows.get("open") or []
    highs = quote_rows.get("high") or []
    lows = quote_rows.get("low") or []
    closes = quote_rows.get("close") or []
    volumes = quote_rows.get("volume") or []
    candles: list[Candle] = []
    for index, timestamp in enumerate(timestamps):
        values = [
            _value_at(opens, index),
            _value_at(highs, index),
            _value_at(lows, index),
            _value_at(closes, index),
        ]
        if any(value is None for value in values):
            continue
        candles.append(
            Candle(
                timestamp=_epoch_to_datetime(int(timestamp)),
                symbol=symbol,
                timeframe="5m",
                open=float(values[0]),
                high=float(values[1]),
                low=float(values[2]),
                close=float(values[3]),
                volume=float(_value_at(volumes, index) or 0),
            )
        )
    return candles


def _value_at(values: list, index: int) -> float | int | None:
    if index >= len(values):
        return None
    return values[index]


def _epoch_to_datetime(value: int) -> datetime:
    return datetime.fromtimestamp(value, tz=UTC)


def _import_mt5_module() -> object:
    try:
        import MetaTrader5 as mt5  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError(
            "MetaTrader5 package is not installed; "
            "install it only in the local MT5 bridge environment"
        ) from exc
    return mt5


def _mt5_rate_to_candle(row: object, *, symbol: str, timeframe: str) -> Candle:
    open_price = float(_mt5_row_value(row, "open"))
    high = float(_mt5_row_value(row, "high"))
    low = float(_mt5_row_value(row, "low"))
    close = float(_mt5_row_value(row, "close"))
    volume = float(
        _mt5_row_value(row, "tick_volume", _mt5_row_value(row, "real_volume", 0.0))
    )
    return Candle(
        timestamp=_epoch_to_datetime(int(_mt5_row_value(row, "time"))),
        symbol=symbol,
        timeframe=timeframe,
        open=open_price,
        high=high,
        low=low,
        close=close,
        volume=volume,
    )


def _mt5_row_value(row: object, key: str, default: object | None = None) -> object:
    try:
        return row[key]  # type: ignore[index]
    except (KeyError, TypeError, ValueError, IndexError):
        return getattr(row, key, default)
