import type { AnchorPoint, Candle, ChartObject } from "./workbenchTypes";

export interface NativeChartGeometry {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  minPrice: number;
  maxPrice: number;
  slotWidth: number;
  candleWidth: number;
}

export interface NativeChartPoint {
  x: number;
  y: number;
  clamped?: boolean;
}

const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 600;
const PLOT_LEFT = 16;
const PLOT_RIGHT = 928;
const PLOT_TOP = 22;
const PLOT_BOTTOM = 558;

export function createNativeChartGeometry(
  candles: Candle[],
  objects: ChartObject[] = []
): NativeChartGeometry {
  const levels = [...candles.flatMap((candle) => [candle.high, candle.low]), ...objectPrices(objects)];
  const rawMin = Math.min(...levels);
  const rawMax = Math.max(...levels);
  const range = Math.max(rawMax - rawMin, 1);
  const padding = Math.max(range * 0.08, 0.5);
  const slotWidth = (PLOT_RIGHT - PLOT_LEFT) / Math.max(candles.length, 1);
  return {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    plotLeft: PLOT_LEFT,
    plotRight: PLOT_RIGHT,
    plotTop: PLOT_TOP,
    plotBottom: PLOT_BOTTOM,
    minPrice: rawMin - padding,
    maxPrice: rawMax + padding,
    slotWidth,
    candleWidth: clamp(slotWidth * 0.58, 2.4, 12)
  };
}

export function candleCenterX(index: number, geometry: NativeChartGeometry) {
  return geometry.plotLeft + geometry.slotWidth * (index + 0.5);
}

export function projectNativePoint(
  anchor: AnchorPoint,
  candles: Candle[],
  geometry: NativeChartGeometry
): NativeChartPoint {
  const rawX = candleCenterX(anchor.time_index, geometry);
  const rawY =
    geometry.plotTop +
    ((geometry.maxPrice - anchor.price) / Math.max(geometry.maxPrice - geometry.minPrice, 1)) *
      (geometry.plotBottom - geometry.plotTop);
  const x = clamp(rawX, geometry.plotLeft, geometry.plotRight);
  const y = clamp(rawY, geometry.plotTop, geometry.plotBottom);
  return {
    x,
    y,
    ...(x !== rawX || y !== rawY ? { clamped: true } : {})
  };
}

export function priceTicks(geometry: NativeChartGeometry, count = 7) {
  return Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0 : index / (count - 1);
    const price = geometry.maxPrice - (geometry.maxPrice - geometry.minPrice) * ratio;
    return {
      price,
      y:
        geometry.plotTop +
        ratio * (geometry.plotBottom - geometry.plotTop)
    };
  });
}

export function timeGridIndexes(candles: Candle[], count = 8) {
  if (candles.length <= 1) {
    return [0];
  }
  const step = Math.max(1, Math.floor((candles.length - 1) / Math.max(count - 1, 1)));
  const indexes = new Set<number>();
  for (let index = 0; index < candles.length; index += step) {
    indexes.add(index);
  }
  indexes.add(candles.length - 1);
  return [...indexes].sort((left, right) => left - right);
}

export function chartObjectIsVisible(
  object: ChartObject,
  indexOffset: number,
  visibleCount: number
) {
  const [minIndex, maxIndex] = objectIndexRange(object);
  const windowStart = indexOffset;
  const windowEnd = indexOffset + visibleCount - 1;
  return maxIndex >= windowStart && minIndex <= windowEnd;
}

export function objectIndexRange(object: ChartObject): [number, number] {
  if (object.kind === "trendline") {
    return minMax(object.anchors.map((anchor) => anchor.time_index));
  }
  if (object.kind === "channel") {
    return minMax([
      object.base.anchors[0].time_index,
      object.base.anchors[1].time_index,
      object.parallel_anchor.time_index
    ]);
  }
  if (object.kind === "range_box") {
    return [object.start_index, object.end_index];
  }
  if (object.kind === "fibonacci") {
    return minMax([object.start.time_index, object.end.time_index]);
  }
  if (object.kind === "measured_move") {
    return minMax([object.start.time_index, object.end.time_index, object.projected_from.time_index]);
  }
  if (object.kind === "three_push") {
    return minMax(object.pushes.map((push) => push.time_index));
  }
  return [object.time_index, object.time_index];
}

function objectPrices(objects: ChartObject[]) {
  return objects.flatMap((object) => {
    if (object.kind === "trendline") {
      return object.anchors.map((anchor) => anchor.price);
    }
    if (object.kind === "channel") {
      return [
        ...object.base.anchors.map((anchor) => anchor.price),
        object.parallel_anchor.price
      ];
    }
    if (object.kind === "range_box") {
      return [object.high, object.low];
    }
    if (object.kind === "fibonacci") {
      return [object.start.price, object.end.price, ...Object.values(object.levels)];
    }
    if (object.kind === "measured_move") {
      return [object.start.price, object.end.price, object.projected_from.price, object.target_price];
    }
    if (object.kind === "three_push") {
      return object.pushes.map((push) => push.price);
    }
    return [object.price];
  });
}

function minMax(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
