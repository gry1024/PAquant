from __future__ import annotations

from typing import Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field


class BrokerOrderIntent(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: str
    side: Literal["buy", "sell"]
    order_type: Literal["market", "limit", "stop"]
    quantity: float = Field(gt=0)
    entry: float | None
    stop: float
    target: float


class BrokerOrderReceipt(BaseModel):
    model_config = ConfigDict(frozen=True)

    broker_order_id: str
    status: Literal["accepted_simulated", "rejected"]
    live: bool


class BrokerAdapter(Protocol):
    def place_order(self, intent: BrokerOrderIntent) -> BrokerOrderReceipt: ...

    def cancel_order(self, broker_order_id: str) -> BrokerOrderReceipt: ...

    def modify_order(
        self, broker_order_id: str, intent: BrokerOrderIntent
    ) -> BrokerOrderReceipt: ...

    def get_positions(self) -> list[dict]: ...

    def get_account(self) -> dict: ...

    def get_symbol_info(self, symbol: str) -> dict: ...


class MockBrokerAdapter:
    def place_order(self, intent: BrokerOrderIntent) -> BrokerOrderReceipt:
        return BrokerOrderReceipt(
            broker_order_id=f"mock-{intent.symbol}-{intent.side}",
            status="accepted_simulated",
            live=False,
        )

    def cancel_order(self, broker_order_id: str) -> BrokerOrderReceipt:
        return BrokerOrderReceipt(
            broker_order_id=broker_order_id, status="accepted_simulated", live=False
        )

    def modify_order(self, broker_order_id: str, intent: BrokerOrderIntent) -> BrokerOrderReceipt:
        return BrokerOrderReceipt(
            broker_order_id=f"{broker_order_id}-{intent.order_type}",
            status="accepted_simulated",
            live=False,
        )

    def get_positions(self) -> list[dict]:
        return []

    def get_account(self) -> dict:
        return {"mode": "simulated", "live": False}

    def get_symbol_info(self, symbol: str) -> dict:
        return {"symbol": symbol, "live": False}
