from __future__ import annotations

from paquant.data_layer.schemas import Candle
from paquant.simulation_engine.orders import (
    OrderSide,
    OrderStatus,
    OrderType,
    SimulatedOrder,
    SimulatedTrade,
)


class SimulationEngine:
    def __init__(self, starting_equity: float) -> None:
        self.starting_equity = starting_equity
        self.equity = starting_equity
        self.orders: list[SimulatedOrder] = []
        self.trades: list[SimulatedTrade] = []
        self._open_orders: list[SimulatedOrder] = []
        self._open_positions: list[SimulatedOrder] = []
        self.equity_curve: list[dict[str, float | str]] = [
            {"time": "start", "equity": starting_equity}
        ]

    def submit_order(self, order: SimulatedOrder) -> SimulatedOrder:
        self.orders.append(order)
        self._open_orders.append(order)
        return order

    def on_candle(self, candle: Candle) -> None:
        for order in list(self._open_orders):
            if self._should_fill(order, candle):
                order.status = OrderStatus.FILLED
                self._open_orders.remove(order)
                self._open_positions.append(order)

        for order in list(self._open_positions):
            trade = self._maybe_close(order, candle)
            if trade is not None:
                order.status = OrderStatus.CLOSED
                self._open_positions.remove(order)
                self.trades.append(trade)
                self.equity += trade.pnl
                self.equity_curve.append(
                    {"time": candle.timestamp.isoformat(), "equity": self.equity}
                )

    def _should_fill(self, order: SimulatedOrder, candle: Candle) -> bool:
        if order.order_type == OrderType.MARKET:
            return True
        return candle.low <= order.entry <= candle.high

    def _maybe_close(self, order: SimulatedOrder, candle: Candle) -> SimulatedTrade | None:
        if order.side == OrderSide.BUY:
            stop_hit = candle.low <= order.stop
            target_hit = candle.high >= order.target
            if stop_hit:
                return self._close(order, order.stop, "stopped")
            if target_hit:
                return self._close(order, order.target, "target")
        else:
            stop_hit = candle.high >= order.stop
            target_hit = candle.low <= order.target
            if stop_hit:
                return self._close(order, order.stop, "stopped")
            if target_hit:
                return self._close(order, order.target, "target")
        return None

    def _close(self, order: SimulatedOrder, exit_price: float, outcome: str) -> SimulatedTrade:
        risk_points = abs(order.entry - order.stop)
        signed_points = exit_price - order.entry
        if order.side == OrderSide.SELL:
            signed_points *= -1
        pnl = signed_points * order.quantity
        r_multiple = pnl / (risk_points * order.quantity) if risk_points else 0
        return SimulatedTrade(
            order_id=order.id,
            symbol=order.symbol,
            timeframe=order.timeframe,
            side=order.side,
            setup_name=order.setup_name,
            entry=order.entry,
            stop=order.stop,
            target=order.target,
            exit=exit_price,
            quantity=order.quantity,
            risk_points=risk_points,
            pnl=pnl,
            r_multiple=r_multiple,
            outcome=outcome,
        )
