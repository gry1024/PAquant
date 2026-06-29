import pytest
from paquant.data_layer.sample_data import load_sample_candles
from paquant.data_layer.schemas import Candle
from pydantic import ValidationError


def test_candle_rejects_invalid_high_low():
    with pytest.raises(ValidationError):
        Candle(
            timestamp="2026-06-30T00:00:00Z",
            symbol="XAUUSD",
            timeframe="5m",
            open=2300,
            high=2290,
            low=2310,
            close=2305,
            volume=100,
        )


def test_sample_candles_are_xau_5m_and_deterministic():
    first = load_sample_candles()
    second = load_sample_candles()

    assert first == second
    assert len(first) >= 48
    assert {candle.symbol for candle in first} == {"XAUUSD"}
    assert {candle.timeframe for candle in first} == {"5m"}
    assert all(candle.high >= max(candle.open, candle.close) for candle in first)
    assert all(candle.low <= min(candle.open, candle.close) for candle in first)
    assert first[0].body == pytest.approx(abs(first[0].close - first[0].open))
