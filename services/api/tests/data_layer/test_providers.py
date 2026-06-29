import pytest
from paquant.data_layer.providers import (
    InMemoryHistoricalDataProvider,
    normalize_instrument_symbol,
    parse_ohlcv_csv,
)


def test_normalizes_provider_specific_xau_symbols():
    assert normalize_instrument_symbol("XAUUSD") == "XAUUSD"
    assert normalize_instrument_symbol("xau/usd") == "XAUUSD"
    assert normalize_instrument_symbol("XAUUSDc") == "XAUUSD"
    assert normalize_instrument_symbol("gold") == "XAUUSD"

    with pytest.raises(ValueError):
        normalize_instrument_symbol("EURUSD")


def test_parse_ohlcv_csv_sorts_and_normalizes_candles():
    csv_text = """timestamp,open,high,low,close,volume
2026-06-30T00:05:00Z,2310,2315,2309,2312,120
2026-06-30T00:00:00Z,2308,2311,2307,2310,100
"""

    candles = parse_ohlcv_csv(csv_text, symbol="XAUUSDc", timeframe="5m")

    assert [candle.timestamp.isoformat() for candle in candles] == [
        "2026-06-30T00:00:00+00:00",
        "2026-06-30T00:05:00+00:00",
    ]
    assert {candle.symbol for candle in candles} == {"XAUUSD"}
    assert candles[1].close == 2312


def test_parse_ohlcv_csv_rejects_unsupported_timeframe():
    with pytest.raises(ValueError):
        parse_ohlcv_csv(
            "timestamp,open,high,low,close,volume\n"
            "2026-06-30T00:00:00Z,2308,2311,2307,2310,100\n",
            symbol="XAUUSD",
            timeframe="1m",
        )


def test_in_memory_provider_returns_requested_xau_5m_data():
    candles = parse_ohlcv_csv(
        "timestamp,open,high,low,close,volume\n"
        "2026-06-30T00:00:00Z,2308,2311,2307,2310,100\n",
        symbol="XAU/USD",
    )
    provider = InMemoryHistoricalDataProvider(candles)

    assert provider.load_candles("XAUUSDc", "5m") == candles
    with pytest.raises(ValueError):
        provider.load_candles("EURUSD", "5m")
