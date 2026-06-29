from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class OrderSide(StrEnum):
    BUY = "buy"
    SELL = "sell"


class OrderType(StrEnum):
    MARKET = "market"
    LIMIT = "limit"


class OrderStatus(StrEnum):
    SUBMITTED = "submitted"
    FILLED = "filled"
    CANCELED = "canceled"
    CLOSED = "closed"


class SimulatedOrder(BaseModel):
    model_config = ConfigDict(validate_assignment=True)

    id: str
    symbol: str
    timeframe: str
    side: OrderSide
    order_type: OrderType
    entry: float
    stop: float
    target: float
    quantity: float = Field(gt=0)
    setup_name: str
    status: OrderStatus = OrderStatus.SUBMITTED

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
    pnl: float
    r_multiple: float
    outcome: str
