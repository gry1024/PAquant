from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class OrderSide(StrEnum):
    BUY = "buy"
    SELL = "sell"


class OrderType(StrEnum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"


class OrderStatus(StrEnum):
    SUBMITTED = "submitted"
    TRIGGERED = "triggered"
    FILLED = "filled"
    CANCELED = "canceled"
    CLOSED = "closed"


class RiskSettings(BaseModel):
    model_config = ConfigDict(frozen=True)

    max_risk_per_order: float | None = None
    max_quantity: float | None = None


class ExecutionSettings(BaseModel):
    model_config = ConfigDict(frozen=True)

    spread_points: float = Field(default=0.0, ge=0)
    slippage_points: float = Field(default=0.0, ge=0)


class SimulatedOrder(BaseModel):
    model_config = ConfigDict(validate_assignment=True)

    id: str
    symbol: str
    timeframe: str
    side: OrderSide
    order_type: OrderType
    activation_price: float | None = None
    entry: float
    stop: float
    target: float
    quantity: float = Field(gt=0)
    setup_name: str
    reason: str = ""
    status: OrderStatus = OrderStatus.SUBMITTED
    filled_entry: float | None = None

    @model_validator(mode="after")
    def validate_stop_limit_trigger(self) -> SimulatedOrder:
        if self.order_type == OrderType.STOP_LIMIT and self.activation_price is None:
            raise ValueError("stop-limit orders require activation_price")
        return self

    @classmethod
    def limit_buy(
        cls,
        *,
        symbol: str,
        timeframe: str,
        entry: float,
        stop: float,
        target: float,
        quantity: float,
        setup_name: str,
        reason: str = "",
    ) -> SimulatedOrder:
        return cls(
            id=f"sim-{symbol}-{timeframe}-{setup_name}",
            symbol=symbol,
            timeframe=timeframe,
            side=OrderSide.BUY,
            order_type=OrderType.LIMIT,
            entry=entry,
            stop=stop,
            target=target,
            quantity=quantity,
            setup_name=setup_name,
            reason=reason,
        )


class SimulatedTrade(BaseModel):
    model_config = ConfigDict(frozen=True)

    order_id: str
    symbol: str
    timeframe: str
    side: OrderSide
    setup_name: str
    entry: float
    stop: float
    target: float
    exit: float
    quantity: float
    risk_points: float
    mfe_points: float
    mae_points: float
    max_favorable_r: float
    max_adverse_r: float
    pnl: float
    r_multiple: float
    outcome: str


class SetupPerformance(BaseModel):
    model_config = ConfigDict(frozen=True)

    setup_name: str
    trades: int
    wins: int
    losses: int
    win_rate: float
    total_pnl: float
    total_r: float
    average_r: float


class PerformanceSummary(BaseModel):
    model_config = ConfigDict(frozen=True)

    starting_equity: float
    ending_equity: float
    total_trades: int
    win_rate: float
    net_pnl: float
    max_drawdown: float
    setup_stats: list[SetupPerformance]
