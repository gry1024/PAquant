import { useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { CandlestickSeries, ColorType, createChart } from "lightweight-charts";
import { DrawingOverlay } from "./DrawingOverlay";
import { toChartCandles } from "../lib/chartTransforms";
import type { WorkbenchFixture } from "../lib/workbenchTypes";

interface ChartPanelProps {
  fixture: WorkbenchFixture;
  visibleCandleCount: number;
  isStreaming: boolean;
  onToggleStream: () => void;
  onResetReplay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onShowAll: () => void;
}

export function ChartPanel({
  fixture,
  visibleCandleCount,
  isStreaming,
  onToggleStream,
  onResetReplay,
  onStepBack,
  onStepForward,
  onShowAll
}: ChartPanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const visibleCandles = useMemo(
    () => fixture.candles.slice(0, visibleCandleCount),
    [fixture.candles, visibleCandleCount]
  );
  const chartData = useMemo(() => toChartCandles(visibleCandles), [visibleCandles]);

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

  const first = visibleCandles[0] ?? fixture.candles[0];
  const last = visibleCandles.at(-1) ?? first;
  const isAtStart = visibleCandleCount <= 1;
  const isAtEnd = visibleCandleCount >= fixture.candles.length;

  return (
    <section className="chart-panel" aria-label="XAU 5 minute chart">
      <div className="chart-header">
        <div>
          <span className="eyebrow">XAUUSD</span>
          <h2>Replay session</h2>
        </div>
        <div className="chart-stats">
          <span>
            <strong>Open</strong> {first.open.toFixed(2)}
          </span>
          <span>
            <strong>Last price</strong> {last.close.toFixed(2)}
          </span>
          <span>{fixture.chartObjects.length} drawings</span>
        </div>
        <div className="replay-controls" aria-label="Replay controls">
          <button
            type="button"
            className="replay-button stream-toggle"
            aria-label={isStreaming ? "Pause data stream" : "Start data stream"}
            title={isStreaming ? "Pause data stream" : "Start data stream"}
            onClick={onToggleStream}
          >
            {isStreaming ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            type="button"
            className="replay-button"
            aria-label="Reset replay"
            title="Reset replay"
            onClick={onResetReplay}
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            className="replay-button"
            aria-label="Previous bar"
            title="Previous bar"
            onClick={onStepBack}
            disabled={isAtStart}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="replay-counter">
            Bar {visibleCandleCount}/{fixture.candles.length}
          </span>
          <button
            type="button"
            className="replay-button"
            aria-label="Next bar"
            title="Next bar"
            onClick={onStepForward}
            disabled={isAtEnd}
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="replay-button"
            aria-label="Show full replay"
            title="Show full replay"
            onClick={onShowAll}
            disabled={isAtEnd}
          >
            <SkipForward size={15} />
          </button>
        </div>
      </div>
      <div className="chart-stage">
        <div ref={hostRef} className="chart-host" data-testid="chart-host" />
        <DrawingOverlay candles={visibleCandles} objects={fixture.chartObjects} />
      </div>
    </section>
  );
}
