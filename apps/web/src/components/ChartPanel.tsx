import { useEffect, useMemo, useRef } from "react";
import { CandlestickSeries, ColorType, createChart } from "lightweight-charts";
import { DrawingOverlay } from "./DrawingOverlay";
import { toChartCandles } from "../lib/chartTransforms";
import type { WorkbenchFixture } from "../lib/workbenchTypes";

interface ChartPanelProps {
  fixture: WorkbenchFixture;
}

export function ChartPanel({ fixture }: ChartPanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartData = useMemo(() => toChartCandles(fixture.candles), [fixture.candles]);

  useEffect(() => {
    const container = hostRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#f8fafc" },
        textColor: "#354256",
        fontSize: 12
      },
      grid: {
        vertLines: { color: "#e2e8f0" },
        horzLines: { color: "#d8e0ea" }
      },
      rightPriceScale: {
        borderColor: "#c7d2df"
      },
      timeScale: {
        borderColor: "#c7d2df",
        timeVisible: true,
        secondsVisible: false
      },
      crosshair: {
        horzLine: { color: "#5a6b7f" },
        vertLine: { color: "#5a6b7f" }
      }
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#0f9f78",
      downColor: "#d14d52",
      wickUpColor: "#0f9f78",
      wickDownColor: "#d14d52",
      borderVisible: false
    });
    candles.setData(chartData);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
    };
  }, [chartData]);

  const first = fixture.candles[0];
  const last = fixture.candles.at(-1) ?? first;

  return (
    <section className="chart-panel" aria-label="XAU 5 minute chart">
      <div className="chart-header">
        <div>
          <span className="eyebrow">XAUUSD</span>
          <h2>Replay session</h2>
        </div>
        <div className="chart-stats">
          <span>Open {first.open.toFixed(2)}</span>
          <span>Close {last.close.toFixed(2)}</span>
          <span>{fixture.chartObjects.length} drawings</span>
        </div>
      </div>
      <div className="chart-stage">
        <div ref={hostRef} className="chart-host" data-testid="chart-host" />
        <DrawingOverlay candles={fixture.candles} objects={fixture.chartObjects} />
      </div>
    </section>
  );
}
