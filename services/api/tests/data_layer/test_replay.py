from paquant.data_layer.replay import ReplaySession
from paquant.data_layer.sample_data import load_sample_candles


def test_replay_advances_cursor_and_stops_at_end():
    candles = load_sample_candles()[:12]
    replay = ReplaySession(candles)

    assert replay.next(5) == candles[:5]
    assert replay.cursor == 5
    assert replay.next(10) == candles[5:]
    assert replay.cursor == 12
    assert replay.next(1) == []
