import type { CandlestickData, UTCTimestamp } from "lightweight-charts";
import type { AnchorPoint, Candle } from "./workbenchTypes";

export interface OverlayPoint {
  x: number;
  y: number;
}

export function toChartCandles(candles: Candle[]): CandlestickData<UTCTimestamp>[] {
  return candles.map((candle) => ({
    time: Math.floor(Date.parse(candle.timestamp) / 1000) as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close
  }));
}

export function priceBounds(candles: Candle[]) {
  return {
    min: Math.min(...candles.map((candle) => candle.low)),
    max: Math.max(...candles.map((candle) => candle.high))
  };
}

export function projectToOverlay(anchor: AnchorPoint, candles: Candle[]): OverlayPoint {
  const bounds = priceBounds(candles);
  const indexMax = Math.max(candles.length - 1, 1);
  const priceRange = Math.max(bounds.max - bounds.min, 1);

  return {
    x: (anchor.time_index / indexMax) * 100,
    y: ((bounds.max - anchor.price) / priceRange) * 100
  };
}
