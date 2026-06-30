import type { AnchorPoint, Candle } from "./workbenchTypes";

export interface NativeChartCandle {
  time: number;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OverlayPoint {
  x: number;
  y: number;
  clamped?: boolean;
}

export function toNativeChartCandles(candles: Candle[]): NativeChartCandle[] {
  return candles.map((candle) => ({
    time: Date.parse(candle.timestamp),
    timestamp: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume
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

  const rawX = (anchor.time_index / indexMax) * 100;
  const rawY = ((bounds.max - anchor.price) / priceRange) * 100;
  const x = clampPercent(rawX);
  const y = clampPercent(rawY);

  return {
    x,
    y,
    ...(x !== rawX || y !== rawY ? { clamped: true } : {})
  };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 100);
}
