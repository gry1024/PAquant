import pytest
from paquant.data_layer.providers import (
    CsvDownloadSource,
    InMemoryHistoricalDataProvider,
    RemoteCsvHistoricalDataProvider,
    YahooGoldFuturesChartProvider,
    normalize_instrument_symbol,
    parse_ohlcv_csv,
)


class FakeTextTransport:
    def __init__(self, text: str) -> None:
        self.text = text
        self.urls: list[str] = []

    def fetch_text(self, url: str, *, timeout: float) -> str:
        self.urls.append(url)
        return self.text


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


def test_remote_csv_provider_downloads_normalizes_and_caches_xau_data(tmp_path):
    csv_text = """timestamp,open,high,low,close,volume
2026-06-30T00:00:00Z,2308,2311,2307,2310,100
"""
    transport = FakeTextTransport(csv_text)
    provider = RemoteCsvHistoricalDataProvider(
        source=CsvDownloadSource(
            name="dukascopy-xau-5m",
            url="https://example.test/xau-5m.csv",
            symbol="XAUUSDc",
            timeframe="5m",
        ),
        cache_path=tmp_path / "xau-5m.csv",
        transport=transport,
    )

    candles = provider.load_candles("XAUUSD", "5m")

    assert transport.urls == ["https://example.test/xau-5m.csv"]
    assert candles[0].symbol == "XAUUSD"
    assert candles[0].close == 2310
    assert (tmp_path / "xau-5m.csv").read_text(encoding="utf-8") == csv_text


def test_remote_csv_provider_uses_cache_without_second_download(tmp_path):
    cache_path = tmp_path / "xau-5m.csv"
    cache_path.write_text(
        "timestamp,open,high,low,close,volume\n"
        "2026-06-30T00:00:00Z,2308,2311,2307,2310,100\n",
        encoding="utf-8",
    )
    transport = FakeTextTransport("should not be used")
    provider = RemoteCsvHistoricalDataProvider(
        source=CsvDownloadSource(
            name="dukascopy-xau-5m",
            url="https://example.test/xau-5m.csv",
            symbol="XAUUSD",
            timeframe="5m",
        ),
        cache_path=cache_path,
        transport=transport,
    )

    candles = provider.load_candles("XAUUSD", "5m")

    assert candles[0].close == 2310
    assert transport.urls == []


class FakeJsonTransport:
    def __init__(self, payload: dict) -> None:
        self.payload = payload
        self.urls: list[str] = []

    def fetch_json(self, url: str, *, timeout: float) -> dict:
        self.urls.append(url)
        return self.payload


def test_yahoo_gold_futures_provider_parses_live_5m_chart_without_spot_claim():
    provider = YahooGoldFuturesChartProvider(
        transport=FakeJsonTransport(
            {
                "chart": {
                    "result": [
                        {
                            "meta": {
                                "symbol": "GC=F",
                                "regularMarketPrice": 2338.2,
                                "regularMarketTime": 1782820800,
                                "exchangeName": "CMX",
                            },
                            "timestamp": [1782820500, 1782820800],
                            "indicators": {
                                "quote": [
                                    {
                                        "open": [2336.1, 2337.4],
                                        "high": [2338.0, 2339.1],
                                        "low": [2335.8, 2337.0],
                                        "close": [2337.3, 2338.2],
                                        "volume": [1200, 1500],
                                    }
                                ]
                            },
                        }
                    ]
                }
            }
        )
    )

    feed = provider.load_candles("XAUUSD", "5m")

    assert feed.source.id == "yahoo_gc_futures_proxy"
    assert feed.source.instrument_kind == "futures_proxy"
    assert feed.source.is_spot is False
    assert feed.source.is_mock is False
    assert feed.candles[-1].close == 2338.2
    assert feed.quote.price == 2338.2
