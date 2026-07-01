import { fireEvent, render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ChartPanel } from "./ChartPanel";
import fixtureData from "../fixtures/paquant-demo.json";
import type { WorkbenchFixture } from "../lib/workbenchTypes";

const fixture = fixtureData as WorkbenchFixture;

function chartPanelProps(overrides = {}) {
  return {
    fixture,
    visibleCandleCount: fixture.candles.length,
    chartWindowSize: 24,
    chartWindowEndIndex: 60,
    isStreaming: false,
    onToggleStream: vi.fn(),
    onResetReplay: vi.fn(),
    onStepBack: vi.fn(),
    onStepForward: vi.fn(),
    onPanLeft: vi.fn(),
    onPanRight: vi.fn(),
    onShowLatest: vi.fn(),
    onShowAll: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onWindowEndChange: vi.fn(),
    onSetWindowPreset: vi.fn(),
    onViewportChange: vi.fn(),
    ...overrides
  };
}

test("renders a native data-driven candle chart for the controlled window", () => {
  const { container } = render(<ChartPanel {...chartPanelProps()} />);

  expect(container.querySelector(".native-price-chart")).toBeInTheDocument();
  expect(container.querySelector("canvas")).not.toBeInTheDocument();
  expect(container.querySelectorAll(".native-candle")).toHaveLength(24);
  expect(container.querySelector(".native-candle")?.getAttribute("data-candle-index")).toBe("36");
  expect(container.querySelectorAll(".native-axis-label.price").length).toBeGreaterThanOrEqual(5);
  expect(container.querySelector(".native-current-price")).toBeInTheDocument();
});

test("keeps trade markers attached to their candle center when the window changes", () => {
  const { container, rerender } = render(
    <ChartPanel
      {...chartPanelProps({
        chartWindowSize: 24,
        chartWindowEndIndex: 24
      })}
    />
  );

  expect(container.querySelectorAll(".native-candle")).toHaveLength(24);

  const entryDot = container.querySelector(".trade-dot.entry");
  const entryCandle = container.querySelector('.native-candle[data-candle-index="17"]');
  expect(entryDot).toBeInTheDocument();
  expect(entryCandle).toBeInTheDocument();
  expect(entryDot?.getAttribute("data-candle-index")).toBe("17");
  expect(Number(entryDot?.getAttribute("cx"))).toBeCloseTo(
    Number(entryCandle?.getAttribute("data-center-x")),
    4
  );
  const initialEntryX = Number(entryDot?.getAttribute("cx"));

  rerender(
    <ChartPanel
      {...chartPanelProps({
        chartWindowSize: 12,
        chartWindowEndIndex: 18
      })}
    />
  );

  const shiftedEntryDot = container.querySelector(".trade-dot.entry");
  const shiftedEntryCandle = container.querySelector('.native-candle[data-candle-index="17"]');
  expect(shiftedEntryDot).toBeInTheDocument();
  expect(shiftedEntryCandle).toBeInTheDocument();
  const shiftedEntryX = Number(shiftedEntryDot?.getAttribute("cx"));
  expect(shiftedEntryX).not.toBeCloseTo(initialEntryX, 4);
  expect(shiftedEntryX).toBeCloseTo(Number(shiftedEntryCandle?.getAttribute("data-center-x")), 4);
});

test("draws finite scoped objects instead of full-width overlay lines", () => {
  const { container } = render(
    <ChartPanel
      {...chartPanelProps({
        chartWindowSize: 24,
        chartWindowEndIndex: 24
      })}
    />
  );

  const chart = container.querySelector(".native-price-chart") as SVGSVGElement;
  const chartWidth = Number(chart.getAttribute("data-plot-width"));
  expect(chartWidth).toBeGreaterThan(800);

  const fibLine = container.querySelector(".native-drawing-line.fib") as SVGLineElement;
  const entryLine = container.querySelector(".trade-price-line.entry") as SVGLineElement;
  const entryCandle = container.querySelector('.native-candle[data-candle-index="17"]');
  const targetCandle = container.querySelector('.native-candle[data-candle-index="22"]');

  expect(fibLine).toBeInTheDocument();
  expect(entryLine).toBeInTheDocument();
  expect(Number(fibLine.getAttribute("x2")) - Number(fibLine.getAttribute("x1"))).toBeLessThan(
    chartWidth
  );
  expect(Number(entryLine.getAttribute("x2")) - Number(entryLine.getAttribute("x1"))).toBeLessThan(
    chartWidth
  );
  expect(Number(entryLine.getAttribute("x1"))).toBeCloseTo(
    Number(entryCandle?.getAttribute("data-center-x")),
    4
  );
  expect(Number(entryLine.getAttribute("x2"))).toBeCloseTo(
    Number(targetCandle?.getAttribute("data-center-x")),
    4
  );
});

test("renders drawing object reasons as chart-bound metadata", () => {
  const { container } = render(
    <ChartPanel
      {...chartPanelProps({
        chartWindowSize: 24,
        chartWindowEndIndex: 24
      })}
    />
  );

  const anchoredObjects = container.querySelectorAll(".anchored-object[data-object-id]");
  expect(anchoredObjects.length).toBeGreaterThanOrEqual(5);
  anchoredObjects.forEach((object) => {
    expect(object.getAttribute("data-reason")).toBeTruthy();
    expect(object.querySelector("title")?.textContent).toContain(
      object.getAttribute("data-reason")
    );
  });
});

test("range scrubber controls the native chart window without touching drawing coordinates directly", () => {
  const onWindowEndChange = vi.fn();
  const { container } = render(<ChartPanel {...chartPanelProps({ onWindowEndChange })} />);

  const scrubber = container.querySelector(".chart-viewport-scrubber input");
  expect(scrubber).toBeInTheDocument();

  fireEvent.change(scrubber as HTMLInputElement, { target: { value: "48" } });

  expect(onWindowEndChange).toHaveBeenCalledWith(48);
});

test("native chart supports mouse wheel zoom and drag panning", () => {
  const onZoomIn = vi.fn();
  const onZoomOut = vi.fn();
  const onPanLeft = vi.fn();
  const onPanRight = vi.fn();
  const { container } = render(
    <ChartPanel {...chartPanelProps({ onZoomIn, onZoomOut, onPanLeft, onPanRight })} />
  );
  const chart = container.querySelector(".native-price-chart");
  expect(chart).toBeInTheDocument();

  fireEvent.wheel(chart as SVGSVGElement, { deltaY: -120 });
  fireEvent.wheel(chart as SVGSVGElement, { deltaY: 120 });

  expect(onZoomIn).toHaveBeenCalledTimes(1);
  expect(onZoomOut).toHaveBeenCalledTimes(1);

  fireEvent.mouseDown(chart as SVGSVGElement, { clientX: 500 });
  fireEvent.mouseUp(chart as SVGSVGElement, { clientX: 560 });
  fireEvent.mouseDown(chart as SVGSVGElement, { clientX: 500 });
  fireEvent.mouseUp(chart as SVGSVGElement, { clientX: 430 });

  expect(onPanLeft).toHaveBeenCalledTimes(1);
  expect(onPanRight).toHaveBeenCalledTimes(1);
});
