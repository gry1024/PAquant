from paquant.data_layer.sample_data import load_sample_candles
from paquant.simulation_engine.engine import SimulationEngine
from paquant.simulation_engine.orders import SimulatedOrder


def test_limit_order_fills_and_records_r_multiple():
    candles = load_sample_candles()
    engine = SimulationEngine(starting_equity=10_000)
    order = SimulatedOrder.limit_buy(
        symbol="XAUUSD",
        timeframe="5m",
        entry=2310,
        stop=2305,
        target=2320,
        quantity=1,
        setup_name="pullback",
    )

    engine.submit_order(order)
    for candle in candles:
        engine.on_candle(candle)

    assert engine.trades
    assert engine.trades[0].risk_points == 5
    assert engine.trades[0].r_multiple == 2
    assert engine.equity_curve[-1]["equity"] == 10_010
