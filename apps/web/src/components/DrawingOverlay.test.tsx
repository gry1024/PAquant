import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { DrawingOverlay } from "./DrawingOverlay";
import fixtureData from "../fixtures/paquant-demo.json";
import type { WorkbenchFixture } from "../lib/workbenchTypes";

const fixture = fixtureData as WorkbenchFixture;

test("交易标记有清晰标签底板、价格、仓位和理由文字", () => {
  const { container } = render(
    <DrawingOverlay candles={fixture.candles} objects={fixture.chartObjects} />
  );

  expect(screen.getByLabelText("AI图表标注")).toBeInTheDocument();
  expect(screen.getAllByText(/入场 2323.03 仓位 1/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/止损 2316.59/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/止盈 2335.91/).length).toBeGreaterThan(0);
  expect(screen.getByText(/理由：突破信号K线高点/)).toBeInTheDocument();

  const labelBackgrounds = container.querySelectorAll(".trade-marker-label-bg");
  expect(labelBackgrounds.length).toBeGreaterThanOrEqual(3);
  expect(container.querySelector(".trade-marker-label-bg.entry")).toBeInTheDocument();
  expect(container.querySelector(".trade-marker-label-bg.stop")).toBeInTheDocument();
  expect(container.querySelector(".trade-marker-label-bg.target")).toBeInTheDocument();
  expect(container.querySelector(".trade-price-line.entry")).toBeInTheDocument();
  expect(container.querySelector(".trade-price-line.stop")).toBeInTheDocument();
  expect(container.querySelector(".trade-price-line.target")).toBeInTheDocument();
  expect(container.querySelector(".trade-marker-price-tag.entry")).toBeInTheDocument();
});

test("drawing overlay keeps projected geometry inside the visible chart viewport", () => {
  const windowedCandles = fixture.candles.slice(0, 13);
  const { container } = render(
    <DrawingOverlay candles={windowedCandles} objects={fixture.chartObjects} />
  );

  const numericAttributes = ["x", "y", "x1", "x2", "y1", "y2", "cx", "cy"] as const;
  for (const element of Array.from(container.querySelectorAll("line, rect, circle, text"))) {
    for (const attribute of numericAttributes) {
      const rawValue = element.getAttribute(attribute);
      if (rawValue == null) {
        continue;
      }
      const value = Number(rawValue);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  }

  for (const polyline of Array.from(container.querySelectorAll("polyline"))) {
    const points = polyline.getAttribute("points") ?? "";
    for (const pair of points.trim().split(/\s+/)) {
      const [x, y] = pair.split(",").map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  }
});

test("drawing overlay de-emphasizes helper lines clipped to the viewport edge", () => {
  const windowedCandles = fixture.candles.slice(0, 13);
  const { container } = render(
    <DrawingOverlay candles={windowedCandles} objects={fixture.chartObjects} />
  );

  expect(container.querySelectorAll(".overlay-line.clamped").length).toBeGreaterThan(0);
});

test("drawing overlay renders candle-anchored objects with handles and box labels", () => {
  const { container } = render(
    <DrawingOverlay candles={fixture.candles} objects={fixture.chartObjects} />
  );

  const trendLine = container.querySelector(".overlay-line.trend");
  expect(trendLine).toHaveAttribute("data-anchor-start", "0:2306.50");
  expect(trendLine).toHaveAttribute("data-anchor-end", "40:2329.00");
  expect(trendLine).toHaveAttribute("data-object-id", "tl-primary");
  expect(trendLine).toHaveAttribute("data-start-candle-index", "0");
  expect(trendLine).toHaveAttribute("data-end-candle-index", "40");
  expect(trendLine).toHaveAttribute("data-start-price", "2306.50");
  expect(trendLine).toHaveAttribute("data-end-price", "2329.00");
  expect(container.querySelectorAll(".anchor-handle").length).toBeGreaterThanOrEqual(4);
  expect(container.querySelector('.anchor-handle[data-candle-index="0"][data-anchor-price="2306.50"]')).toBeInTheDocument();

  const box = container.querySelector(".overlay-box");
  expect(box).toHaveAttribute("data-object-id", "box-pullback");
  expect(box).toHaveAttribute("data-start-candle-index", "0");
  expect(box).toHaveAttribute("data-end-candle-index", "12");
  expect(box).toHaveAttribute("data-high-price", "2316.00");
  expect(box).toHaveAttribute("data-low-price", "2306.50");

  const boxTitle = container.querySelector(".overlay-box-title");
  expect(boxTitle).toHaveAttribute("data-label-size", "compact");
  expect(screen.getByText("早期回调箱体")).toBeInTheDocument();
  expect(screen.queryByText("Early pullback box")).not.toBeInTheDocument();
});

test("trade markers project the actual order price instead of snapping to candle extremes", () => {
  const candles = [
    {
      timestamp: "2026-06-30T00:00:00Z",
      symbol: "XAUUSD" as const,
      timeframe: "5m" as const,
      open: 118,
      high: 120,
      low: 116,
      close: 119,
      volume: 1,
      body: 1,
      range: 4,
      close_position: 0.75
    },
    {
      timestamp: "2026-06-30T00:05:00Z",
      symbol: "XAUUSD" as const,
      timeframe: "5m" as const,
      open: 110,
      high: 112,
      low: 108,
      close: 111,
      volume: 1,
      body: 1,
      range: 4,
      close_position: 0.75
    },
    {
      timestamp: "2026-06-30T00:10:00Z",
      symbol: "XAUUSD" as const,
      timeframe: "5m" as const,
      open: 94,
      high: 96,
      low: 90,
      close: 95,
      volume: 1,
      body: 1,
      range: 6,
      close_position: 0.83
    }
  ];
  const { container } = render(
    <DrawingOverlay
      candles={candles}
      objects={[
        {
          kind: "trade_marker",
          id: "entry-marker",
          label: "entry",
          time_index: 1,
          price: 100,
          marker_type: "entry",
          quantity: 1,
          reason: "order level"
        }
      ]}
    />
  );

  const dot = container.querySelector(".trade-dot.entry");
  expect(dot).toBeInTheDocument();
  expect(Number(dot?.getAttribute("cy"))).toBeGreaterThan(60);
});
