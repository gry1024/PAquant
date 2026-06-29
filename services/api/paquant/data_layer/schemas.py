from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, computed_field, field_validator, model_validator


class Instrument(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: str
    display_name: str
    broker_symbol: str | None = None


class Candle(BaseModel):
    model_config = ConfigDict(frozen=True)

    timestamp: datetime
    symbol: str
    timeframe: Literal["5m"]
    open: float
    high: float
    low: float
    close: float
    volume: float

    @field_validator("symbol")
    @classmethod
    def normalize_symbol(cls, value: str) -> str:
        normalized = value.upper()
        if normalized != "XAUUSD":
            raise ValueError("phase one supports XAUUSD only")
        return normalized

    @model_validator(mode="after")
    def validate_price_range(self) -> Candle:
        if self.high < max(self.open, self.close):
            raise ValueError("high must be at least open and close")
        if self.low > min(self.open, self.close):
            raise ValueError("low must be at most open and close")
        if self.high < self.low:
            raise ValueError("high must be greater than or equal to low")
        if self.volume < 0:
            raise ValueError("volume must be non-negative")
        return self

    @computed_field
    @property
    def body(self) -> float:
        return abs(self.close - self.open)

    @computed_field
    @property
    def range(self) -> float:
        return self.high - self.low

    @computed_field
    @property
    def close_position(self) -> float:
        if self.range == 0:
            return 0.5
        return (self.close - self.low) / self.range
