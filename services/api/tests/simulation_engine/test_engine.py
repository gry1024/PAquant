from paquant.data_layer.sample_data import load_sample_candles
from paquant.simulation_engine.engine import SimulationEngine
from paquant.simulation_engine.orders import (
    OrderSide,
    OrderStatus,
    OrderType,
    RiskSettings,
    SimulatedOrder,
)


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


def test_risk_guard_rejects_oversized_order():
    engine = SimulationEngine(
        starting_equity=10_000,
        risk_settings=RiskSettings(max_risk_per_order=4),
    )
    order = SimulatedOrder.limit_buy(
        symbol="XAUUSD",
        timeframe="5m",
        entry=2310,
        stop=2305,
        target=2320,
        quantity=1,
        setup_name="oversized pullback",
    )

    try:
        engine.submit_order(order)
    except ValueError as exc:
        assert "risk" in str(exc)
    else:
        raise AssertionError("oversized order should be rejected")


def test_submitted_order_can_be_modified_and_canceled_before_fill():
    candles = load_sample_candles()
    engine = SimulationEngine(starting_equity=10_000)
    order = SimulatedOrder.limit_buy(
        symbol="XAUUSD",
        timeframe="5m",
        entry=2300,
        stop=2295,
        target=2315,
        quantity=1,
        setup_name="waiting pullback",
    )

    engine.submit_order(order)
    modified = engine.modify_order(order.id, entry=2309, stop=2304, target=2319)
    canceled = engine.cancel_order(order.id)
    for candle in candles:
        engine.on_candle(candle)

    assert modified.entry == 2309
    assert modified.stop == 2304
    assert modified.target == 2319
    assert canceled.status == OrderStatus.CANCELED
    assert not engine.trades


def test_buy_stop_order_fills_only_after_candle_crosses_entry():
    candles = load_sample_candles()
    engine = SimulationEngine(starting_equity=10_000)
    order = SimulatedOrder(
        id="buy-stop-breakout",
        symbol="XAUUSD",
        timeframe="5m",
        side=OrderSide.BUY,
        order_type=OrderType.STOP,
        entry=2320,
        stop=2315,
        target=2330,
        quantity=1,
        setup_name="breakout pullback",
    )

    engine.submit_order(order)
    for candle in candles[:14]:
        engine.on_candle(candle)
    assert order.status == OrderStatus.SUBMITTED

    engine.on_candle(candles[14])
    assert order.status == OrderStatus.FILLED


def test_closed_trade_records_mfe_mae_and_r_excursion():
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

    trade = engine.trades[0]
    assert trade.mfe_points >= 10
    assert trade.mae_points <= -3
    assert trade.max_favorable_r >= 2
    assert trade.max_adverse_r <= -0.6


def test_performance_summary_reports_drawdown_and_setup_stats():
    candles = load_sample_candles()
    engine = SimulationEngine(starting_equity=10_000)
    engine.submit_order(
        SimulatedOrder.limit_buy(
            symbol="XAUUSD",
            timeframe="5m",
            entry=2310,
            stop=2309,
            target=2320,
            quantity=1,
            setup_name="failed breakout",
        )
    )
    for candle in candles[:1]:
        engine.on_candle(candle)

    summary = engine.performance_summary()

    assert summary.total_trades == 1
    assert summary.win_rate == 0
    assert summary.max_drawdown == -1
    assert summary.setup_stats[0].setup_name == "failed breakout"
    assert summary.setup_stats[0].average_r == -1
