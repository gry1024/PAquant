from __future__ import annotations

from paquant.data_layer.schemas import Candle
from paquant.simulation_engine.orders import (
    ExecutionSettings,
    OrderSide,
    OrderStatus,
    OrderType,
    PerformanceSummary,
    RiskSettings,
    SetupPerformance,
    SimulatedOrder,
    SimulatedTrade,
)


class SimulationEngine:
    def __init__(
        self,
        starting_equity: float,
        risk_settings: RiskSettings | None = None,
        execution_settings: ExecutionSettings | None = None,
    ) -> None:
        self.starting_equity = starting_equity
        self.equity = starting_equity
        self.risk_settings = risk_settings or RiskSettings()
        self.execution_settings = execution_settings or ExecutionSettings()
        self.orders: list[SimulatedOrder] = []
        self.trades: list[SimulatedTrade] = []
        self._open_orders: list[SimulatedOrder] = []
        self._open_positions: list[SimulatedOrder] = []
        self._position_excursions: dict[str, dict[str, float]] = {}
        self.equity_curve: list[dict[str, float | str]] = [
            {"time": "start", "equity": starting_equity}
        ]

    def submit_order(self, order: SimulatedOrder) -> SimulatedOrder:
        self._validate_order_risk(order)
        self.orders.append(order)
        self._open_orders.append(order)
        return order

    def cancel_order(self, order_id: str) -> SimulatedOrder:
        order = self._find_open_order(order_id)
        order.status = OrderStatus.CANCELED
        self._open_orders.remove(order)
        return order

    def modify_order(
        self,
        order_id: str,
        *,
        entry: float | None = None,
        stop: float | None = None,
        target: float | None = None,
    ) -> SimulatedOrder:
        order = self._find_open_order(order_id)
        original = (order.entry, order.stop, order.target)
        if entry is not None:
            order.entry = entry
        if stop is not None:
            order.stop = stop
        if target is not None:
            order.target = target
        try:
            self._validate_order_risk(order)
        except ValueError:
            order.entry, order.stop, order.target = original
            raise
        return order

    def on_candle(self, candle: Candle) -> None:
        for order in list(self._open_orders):
            if self._should_trigger_stop_limit(order, candle):
                order.status = OrderStatus.TRIGGERED
                continue
            if self._should_fill(order, candle):
                order.status = OrderStatus.FILLED
                order.filled_entry = self._entry_fill_price(order)
                self._open_orders.remove(order)
                self._open_positions.append(order)
                self._position_excursions[order.id] = {"mfe": 0.0, "mae": 0.0}

        for order in list(self._open_positions):
            self._update_excursion(order, candle)
            trade = self._maybe_close(order, candle)
            if trade is not None:
                order.status = OrderStatus.CLOSED
                self._open_positions.remove(order)
                self._position_excursions.pop(order.id, None)
                self.trades.append(trade)
                self.equity += trade.pnl
                self.equity_curve.append(
                    {"time": candle.timestamp.isoformat(), "equity": self.equity}
                )

    def _should_fill(self, order: SimulatedOrder, candle: Candle) -> bool:
        if order.order_type == OrderType.MARKET:
            return True
        if order.order_type == OrderType.STOP_LIMIT:
            if order.status != OrderStatus.TRIGGERED:
                return False
            return candle.low <= order.entry <= candle.high
        if order.order_type == OrderType.STOP:
            if order.side == OrderSide.BUY:
                return candle.high >= order.entry
            return candle.low <= order.entry
        return candle.low <= order.entry <= candle.high

    def _should_trigger_stop_limit(self, order: SimulatedOrder, candle: Candle) -> bool:
        if order.order_type != OrderType.STOP_LIMIT:
            return False
        if order.status != OrderStatus.SUBMITTED:
            return False
        if order.activation_price is None:
            return False
        if order.side == OrderSide.BUY:
            return candle.high >= order.activation_price
        return candle.low <= order.activation_price

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
        entry_price = order.filled_entry if order.filled_entry is not None else order.entry
        actual_exit = self._exit_fill_price(order, exit_price)
        risk_points = round(abs(entry_price - order.stop), 10)
        signed_points = actual_exit - entry_price
        if order.side == OrderSide.SELL:
            signed_points *= -1
        pnl = round(signed_points * order.quantity, 10)
        r_multiple = round(pnl / (risk_points * order.quantity), 10) if risk_points else 0
        excursion = self._position_excursions.get(order.id, {"mfe": 0.0, "mae": 0.0})
        max_favorable_r = excursion["mfe"] / risk_points if risk_points else 0
        max_adverse_r = excursion["mae"] / risk_points if risk_points else 0
        return SimulatedTrade(
            order_id=order.id,
            symbol=order.symbol,
            timeframe=order.timeframe,
            side=order.side,
            setup_name=order.setup_name,
            entry=entry_price,
            stop=order.stop,
            target=order.target,
            exit=actual_exit,
            quantity=order.quantity,
            risk_points=risk_points,
            mfe_points=excursion["mfe"],
            mae_points=excursion["mae"],
            max_favorable_r=max_favorable_r,
            max_adverse_r=max_adverse_r,
            pnl=pnl,
            r_multiple=r_multiple,
            outcome=outcome,
        )

    def performance_summary(self) -> PerformanceSummary:
        total_trades = len(self.trades)
        wins = sum(1 for trade in self.trades if trade.pnl > 0)
        setup_stats = [
            self._setup_performance(setup_name, trades)
            for setup_name, trades in self._group_trades_by_setup().items()
        ]
        return PerformanceSummary(
            starting_equity=self.starting_equity,
            ending_equity=self.equity,
            total_trades=total_trades,
            win_rate=wins / total_trades if total_trades else 0,
            net_pnl=self.equity - self.starting_equity,
            max_drawdown=self._max_drawdown(),
            setup_stats=setup_stats,
        )

    def _find_open_order(self, order_id: str) -> SimulatedOrder:
        for order in self._open_orders:
            if order.id == order_id:
                return order
        raise KeyError(order_id)

    def _validate_order_risk(self, order: SimulatedOrder) -> None:
        order_risk = abs(order.entry - order.stop) * order.quantity
        if (
            self.risk_settings.max_risk_per_order is not None
            and order_risk > self.risk_settings.max_risk_per_order
        ):
            raise ValueError(
                f"order risk {order_risk} exceeds limit "
                f"{self.risk_settings.max_risk_per_order}"
            )
        if (
            self.risk_settings.max_quantity is not None
            and order.quantity > self.risk_settings.max_quantity
        ):
            raise ValueError(
                f"order quantity {order.quantity} exceeds limit "
                f"{self.risk_settings.max_quantity}"
            )

    def _update_excursion(self, order: SimulatedOrder, candle: Candle) -> None:
        excursion = self._position_excursions[order.id]
        entry_price = order.filled_entry if order.filled_entry is not None else order.entry
        if order.side == OrderSide.BUY:
            favorable = candle.high - entry_price
            adverse = candle.low - entry_price
        else:
            favorable = entry_price - candle.low
            adverse = entry_price - candle.high
        excursion["mfe"] = max(excursion["mfe"], favorable, 0)
        excursion["mae"] = min(excursion["mae"], adverse, 0)

    def _entry_fill_price(self, order: SimulatedOrder) -> float:
        adjustment = (
            self.execution_settings.spread_points / 2
            + self.execution_settings.slippage_points
        )
        if order.side == OrderSide.BUY:
            return round(order.entry + adjustment, 10)
        return round(order.entry - adjustment, 10)

    def _exit_fill_price(self, order: SimulatedOrder, exit_price: float) -> float:
        adjustment = (
            self.execution_settings.spread_points / 2
            + self.execution_settings.slippage_points
        )
        if order.side == OrderSide.BUY:
            return round(exit_price - adjustment, 10)
        return round(exit_price + adjustment, 10)

    def _max_drawdown(self) -> float:
        peak = self.starting_equity
        max_drawdown = 0.0
        for point in self.equity_curve:
            equity = float(point["equity"])
            peak = max(peak, equity)
            max_drawdown = min(max_drawdown, equity - peak)
        return max_drawdown

    def _group_trades_by_setup(self) -> dict[str, list[SimulatedTrade]]:
        grouped: dict[str, list[SimulatedTrade]] = {}
        for trade in self.trades:
            grouped.setdefault(trade.setup_name, []).append(trade)
        return grouped

    def _setup_performance(
        self, setup_name: str, trades: list[SimulatedTrade]
    ) -> SetupPerformance:
        wins = sum(1 for trade in trades if trade.pnl > 0)
        losses = sum(1 for trade in trades if trade.pnl <= 0)
        total_pnl = sum(trade.pnl for trade in trades)
        total_r = sum(trade.r_multiple for trade in trades)
        return SetupPerformance(
            setup_name=setup_name,
            trades=len(trades),
            wins=wins,
            losses=losses,
            win_rate=wins / len(trades) if trades else 0,
            total_pnl=total_pnl,
            total_r=total_r,
            average_r=total_r / len(trades) if trades else 0,
        )
