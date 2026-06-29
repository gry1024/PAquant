import { describe, expect, test } from "vitest";
import { projectToOverlay, toChartCandles } from "./chartTransforms";
import type { Candle } from "./workbenchTypes";

const candles: Candle[] = [
  {
    timestamp: "2026-06-30T00:00:00Z",
    symbol: "XAUUSD",
    timeframe: "5m",
    open: 2300,
    high: 2310,
    low: 2290,
    close: 2305,
    volume: 10,
    body: 5,
    range: 20,
    close_position: 0.75
  },
  {
    timestamp: "2026-06-30T00:05:00Z",
    symbol: "XAUUSD",
    timeframe: "5m",
    open: 2305,
    high: 2320,
    low: 2300,
    close: 2315,
    volume: 10,
    body: 10,
    range: 20,
    close_position: 0.75
  }
];

describe("chart transforms", () => {
  test("converts backend candles to lightweight-charts data", () => {
    expect(toChartCandles(candles)[0]).toMatchObject({
      open: 2300,
      high: 2310,
      low: 2290,
      close: 2305
    });
  });

  test("projects anchor points into overlay percentages", () => {
    expect(projectToOverlay({ time_index: 1, price: 2320 }, candles)).toEqual({
      x: 100,
      y: 0
    });
  });
});
