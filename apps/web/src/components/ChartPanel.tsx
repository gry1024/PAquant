import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Minus, Pause, Play, Plus, RotateCcw, SkipForward } from "lucide-react";
import { NativePriceChart } from "./NativePriceChart";
import type { WorkbenchFixture } from "../lib/workbenchTypes";

interface ChartPanelProps {
  fixture: WorkbenchFixture;
  visibleCandleCount: number;
  chartWindowSize: number;
  chartWindowEndIndex: number;
  isStreaming: boolean;
  onToggleStream: () => void;
  onResetReplay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onPanLeft: () => void;
  onPanRight: () => void;
  onShowLatest: () => void;
  onShowAll: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onWindowEndChange: (endIndex: number) => void;
  onViewportChange: (viewport: { windowSize: number; windowEndIndex: number }) => void;
  onSetWindowPreset: (preset: 48 | 96 | "all" | "latest") => void;
}

export function ChartPanel({
  fixture,
  visibleCandleCount,
  chartWindowSize,
  chartWindowEndIndex,
  isStreaming,
  onToggleStream,
  onResetReplay,
  onStepBack,
  onStepForward,
  onPanLeft,
  onPanRight,
  onShowLatest,
  onShowAll,
  onZoomIn,
  onZoomOut,
  onWindowEndChange,
  onSetWindowPreset
}: ChartPanelProps) {
  const replayCandles = useMemo(
    () => fixture.candles.slice(0, visibleCandleCount),
    [fixture.candles, visibleCandleCount]
  );
  const windowEndIndex = Math.min(Math.max(chartWindowEndIndex, 1), replayCandles.length);
  const windowStartIndex = Math.max(0, windowEndIndex - chartWindowSize);
  const visibleCandles = useMemo(
    () => replayCandles.slice(windowStartIndex, windowEndIndex),
    [replayCandles, windowStartIndex, windowEndIndex]
  );
  const tradeMarkers = useMemo(
    () =>
      fixture.chartObjects.filter(
        (
          object
        ): object is Extract<WorkbenchFixture["chartObjects"][number], { kind: "trade_marker" }> =>
          object.kind === "trade_marker"
      ),
    [fixture.chartObjects]
  );

  const first = visibleCandles[0] ?? replayCandles[0] ?? fixture.candles[0];
  const last = replayCandles.at(-1) ?? first;
  const isAtStart = visibleCandleCount <= 1;
  const isAtEnd = visibleCandleCount >= fixture.candles.length;
  const isFullWindow = chartWindowSize >= visibleCandleCount;
  const canPanLeft = windowStartIndex > 0;
  const canPanRight = windowEndIndex < replayCandles.length;
  const scrubberMin = Math.min(Math.max(chartWindowSize, 1), Math.max(visibleCandleCount, 1));
  const scrubberMax = Math.max(scrubberMin, visibleCandleCount);
  const scrubberValue = Math.min(Math.max(windowEndIndex, scrubberMin), scrubberMax);

  return (
    <section className="chart-panel" aria-label="XAU 5分钟K线图">
      <div className="chart-header">
        <div>
          <span className="eyebrow">XAUUSD</span>
          <h2>原生价格行为K线</h2>
        </div>
        <div className="chart-stats">
          <span>
            <strong>开盘</strong> {first.open.toFixed(2)}
          </span>
          <span>
            <strong>最新收盘</strong> {last.close.toFixed(2)}
          </span>
          <span>{fixture.chartObjects.length} 个AI标注</span>
        </div>
        <div className="chart-control-deck">
          <div className="range-preset-strip" aria-label="K线视窗快捷切换">
            <button type="button" onClick={() => onSetWindowPreset(48)}>
              最近48
            </button>
            <button type="button" onClick={() => onSetWindowPreset(96)}>
              最近96
            </button>
            <button type="button" onClick={() => onSetWindowPreset("all")}>
              全部
            </button>
            <button type="button" onClick={() => onSetWindowPreset("latest")}>
              最新
            </button>
          </div>
          <div className="replay-controls" aria-label="回放控制">
          <button
            type="button"
            className="replay-button stream-toggle"
            aria-label={isStreaming ? "暂停行情" : "播放行情"}
            title={isStreaming ? "暂停行情" : "播放行情"}
            onClick={onToggleStream}
          >
            {isStreaming ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            type="button"
            className="replay-button"
            aria-label="重置回放"
            title="重置回放"
            onClick={onResetReplay}
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            className="replay-button"
            aria-label="上一根 K 线"
            title="上一根 K 线"
            onClick={onStepBack}
            disabled={isAtStart}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="replay-counter">
            K 线 {visibleCandleCount}/{fixture.candles.length}
          </span>
          <span className="window-counter">窗口 {visibleCandles.length} 根</span>
          <button
            type="button"
            className="replay-button"
            aria-label="下一根 K 线"
            title="下一根 K 线"
            onClick={onStepForward}
            disabled={isAtEnd}
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="replay-button"
            aria-label="向左滑动图表"
            title="向左滑动图表"
            onClick={onPanLeft}
            disabled={!canPanLeft}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="replay-button"
            aria-label="向右滑动图表"
            title="向右滑动图表"
            onClick={onPanRight}
            disabled={!canPanRight}
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="replay-button"
            aria-label="放大 K 线"
            title="放大 K 线"
            onClick={onZoomIn}
            disabled={visibleCandleCount <= 12}
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            className="replay-button"
            aria-label="缩小 K 线"
            title="缩小 K 线"
            onClick={onZoomOut}
            disabled={isFullWindow}
          >
            <Minus size={15} />
          </button>
          <button
            type="button"
            className="replay-button"
            aria-label="回到最新 K 线"
            title="回到最新 K 线"
            onClick={onShowLatest}
            disabled={!canPanRight}
          >
            <SkipForward size={15} />
          </button>
          <button
            type="button"
            className="replay-button"
            aria-label="显示全部"
            title="显示全部"
            onClick={onShowAll}
            disabled={isFullWindow}
          >
            <SkipForward size={15} />
          </button>
          </div>
        </div>
        <label className="chart-viewport-scrubber">
          <span>视窗滑动</span>
          <input
            aria-label="图表视窗滑杆"
            type="range"
            min={scrubberMin}
            max={scrubberMax}
            step={1}
            value={scrubberValue}
            onChange={(event) => onWindowEndChange(Number(event.currentTarget.value))}
          />
          <strong>
            {windowStartIndex + 1}-{windowEndIndex} / {visibleCandleCount}
          </strong>
        </label>
      </div>
      <div className="chart-stage">
        <div className="chart-host native-chart-host" data-testid="chart-host">
          <NativePriceChart
            candles={visibleCandles}
            objects={fixture.chartObjects}
            indexOffset={windowStartIndex}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onPanLeft={onPanLeft}
            onPanRight={onPanRight}
          />
        </div>
        {tradeMarkers.length ? (
          <div className="chart-order-ribbon" aria-label="图表订单标注摘要">
            {tradeMarkers.map((marker) => (
              <span key={marker.id} className={`chart-order-chip ${marker.marker_type}`}>
                {formatTradeMarkerChip(marker)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function formatTradeMarkerChip(
  marker: Extract<WorkbenchFixture["chartObjects"][number], { kind: "trade_marker" }>
) {
  const label =
    marker.marker_type === "entry"
      ? "入场"
      : marker.marker_type === "stop"
        ? "止损"
        : marker.marker_type === "target"
          ? "止盈"
          : "成交";
  const quantity = marker.quantity == null ? "" : ` 仓位 ${marker.quantity}`;
  return `${label} ${marker.price.toFixed(2)}${quantity}`;
}
