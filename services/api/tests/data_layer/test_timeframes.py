from paquant.data_layer.sample_data import load_sample_candles
from paquant.data_layer.timeframes import build_higher_timeframe_context


def test_builds_auxiliary_m15_and_h1_context_from_xau_5m_candles():
    contexts = build_higher_timeframe_context(load_sample_candles())

    assert [context.timeframe for context in contexts] == ["15m", "1h"]
    assert contexts[0].bars == 24
    assert contexts[1].bars == 6
    assert contexts[0].bias in {"long", "short", "neutral"}
    assert contexts[0].high >= contexts[0].low
    assert "derived from XAU 5m" in contexts[0].summary
