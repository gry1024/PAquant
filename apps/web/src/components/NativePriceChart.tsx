import {
  candleCenterX,
  chartObjectIsVisible,
  createNativeChartGeometry,
  priceTicks,
  projectNativePoint,
  timeGridIndexes
} from "../lib/nativeChartGeometry";
import { translateText } from "../lib/displayText";
import { useRef } from "react";
import type { ReactNode } from "react";
import type { AnchorPoint, Candle, ChartObject } from "../lib/workbenchTypes";

interface NativePriceChartProps {
  candles: Candle[];
  objects: ChartObject[];
  indexOffset: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPanLeft: () => void;
  onPanRight: () => void;
}

type Geometry = ReturnType<typeof createNativeChartGeometry>;
type TradeMarkerObject = Extract<ChartObject, { kind: "trade_marker" }>;

export function NativePriceChart({
  candles,
  objects,
  indexOffset,
  onZoomIn,
  onZoomOut,
  onPanLeft,
  onPanRight
}: NativePriceChartProps) {
  const dragStartXRef = useRef<number | null>(null);
  const visibleObjects = objects.filter((object) =>
    chartObjectIsVisible(object, indexOffset, candles.length)
  );
  const geometry = createNativeChartGeometry(candles, visibleObjects);
  const ticks = priceTicks(geometry);
  const gridIndexes = timeGridIndexes(candles);
  const last = candles.at(-1);

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    if (event.deltaY < 0) {
      onZoomIn();
    } else if (event.deltaY > 0) {
      onZoomOut();
    }
  };
  const beginDrag = (clientX: number) => {
    dragStartXRef.current = clientX;
  };
  const endDrag = (clientX: number) => {
    const startX = dragStartXRef.current;
    dragStartXRef.current = null;
    if (startX == null) {
      return;
    }
    const delta = clientX - startX;
    if (delta > 32) {
      onPanLeft();
    } else if (delta < -32) {
      onPanRight();
    }
  };
  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    beginDrag(event.clientX);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    endDrag(event.clientX);
  };

  return (
    <svg
      className="native-price-chart"
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="PAquant 数据驱动 K 线图"
      onWheel={handleWheel}
      onMouseDown={(event) => beginDrag(event.clientX)}
      onMouseUp={(event) => endDrag(event.clientX)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      data-plot-left={geometry.plotLeft}
      data-plot-right={geometry.plotRight}
      data-plot-width={geometry.plotRight - geometry.plotLeft}
    >
      <rect className="native-chart-bg" x={0} y={0} width={geometry.width} height={geometry.height} />
      <g className="native-grid-layer" aria-hidden="true">
        {ticks.map((tick) => (
          <g key={tick.price.toFixed(4)}>
            <line
              className="native-grid-line horizontal"
              x1={geometry.plotLeft}
              x2={geometry.plotRight}
              y1={tick.y}
              y2={tick.y}
            />
            <text className="native-axis-label price" x={geometry.plotRight + 12} y={tick.y + 4}>
              {tick.price.toFixed(2)}
            </text>
          </g>
        ))}
        {gridIndexes.map((index) => {
          const x = candleCenterX(index, geometry);
          return (
            <g key={index}>
              <line
                className="native-grid-line vertical"
                x1={x}
                x2={x}
                y1={geometry.plotTop}
                y2={geometry.plotBottom}
              />
              <text className="native-axis-label time" x={x} y={geometry.plotBottom + 24}>
                {formatTime(candles[index]?.timestamp)}
              </text>
            </g>
          );
        })}
      </g>

      <g className="native-candle-layer">
        {candles.map((candle, index) => (
          <NativeCandle
            key={`${candle.timestamp}-${index}`}
            candle={candle}
            localIndex={index}
            absoluteIndex={index + indexOffset}
            geometry={geometry}
          />
        ))}
      </g>

      {last ? (
        <g className="native-current-price">
          <line
            x1={geometry.plotLeft}
            x2={geometry.plotRight}
            y1={projectNativePoint({ time_index: candles.length - 1, price: last.close }, candles, geometry).y}
            y2={projectNativePoint({ time_index: candles.length - 1, price: last.close }, candles, geometry).y}
          />
          <text
            x={geometry.plotRight + 10}
            y={projectNativePoint({ time_index: candles.length - 1, price: last.close }, candles, geometry).y + 4}
          >
            {last.close.toFixed(2)}
          </text>
        </g>
      ) : null}

      <g className="native-drawing-layer" aria-label="AI 图表标注">
        {visibleObjects.map((object) => (
          <NativeChartObject
            key={object.id}
            object={object}
            candles={candles}
            indexOffset={indexOffset}
            geometry={geometry}
          />
        ))}
      </g>
    </svg>
  );
}

function NativeCandle({
  candle,
  localIndex,
  absoluteIndex,
  geometry
}: {
  candle: Candle;
  localIndex: number;
  absoluteIndex: number;
  geometry: Geometry;
}) {
  const centerX = candleCenterX(localIndex, geometry);
  const high = projectNativePoint({ time_index: localIndex, price: candle.high }, [candle], geometry);
  const low = projectNativePoint({ time_index: localIndex, price: candle.low }, [candle], geometry);
  const open = projectNativePoint({ time_index: localIndex, price: candle.open }, [candle], geometry);
  const close = projectNativePoint({ time_index: localIndex, price: candle.close }, [candle], geometry);
  const bodyTop = Math.min(open.y, close.y);
  const bodyHeight = Math.max(Math.abs(close.y - open.y), 1.4);
  const direction = candle.close >= candle.open ? "up" : "down";

  return (
    <g
      className={`native-candle ${direction}`}
      data-candle-index={absoluteIndex}
      data-center-x={centerX.toFixed(4)}
      data-open={candle.open.toFixed(2)}
      data-high={candle.high.toFixed(2)}
      data-low={candle.low.toFixed(2)}
      data-close={candle.close.toFixed(2)}
    >
      <line className="native-candle-wick" x1={centerX} x2={centerX} y1={high.y} y2={low.y} />
      <rect
        className="native-candle-body"
        x={centerX - geometry.candleWidth / 2}
        y={bodyTop}
        width={geometry.candleWidth}
        height={bodyHeight}
        rx={0.9}
      />
    </g>
  );
}

function NativeChartObject({
  object,
  candles,
  indexOffset,
  geometry
}: {
  object: ChartObject;
  candles: Candle[];
  indexOffset: number;
  geometry: Geometry;
}) {
  if (object.kind === "trendline") {
    const segment = clipAnchorSegment(object.anchors[0], object.anchors[1], indexOffset, candles.length);
    if (!segment) {
      return null;
    }
    const start = projectNativePoint(localAnchor(segment.start, indexOffset), candles, geometry);
    const end = projectNativePoint(localAnchor(segment.end, indexOffset), candles, geometry);
    const reason = objectReason(object, "趋势线标出当前始终在场方向的有效观察区间。");
    return (
      <ObjectGroup object={object} reason={reason} className="trendline-object">
        <line
          className="native-drawing-line trend"
          data-object-id={object.id}
          data-start-candle-index={segment.start.time_index}
          data-end-candle-index={segment.end.time_index}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
        />
        <AnchorDot point={start} anchor={segment.start} />
        <AnchorDot point={end} anchor={segment.end} />
        <ObjectLabel x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 8} text={object.label} />
      </ObjectGroup>
    );
  }

  if (object.kind === "channel") {
    const [rawStart, rawEnd] = object.base.anchors;
    const baseSegment = clipAnchorSegment(rawStart, rawEnd, indexOffset, candles.length);
    if (!baseSegment) {
      return null;
    }
    const offset = object.parallel_anchor.price - linePriceAt(rawStart, rawEnd, object.parallel_anchor.time_index);
    const parallelSegment = {
      start: { ...baseSegment.start, price: baseSegment.start.price + offset },
      end: { ...baseSegment.end, price: baseSegment.end.price + offset }
    };
    const baseStart = projectNativePoint(localAnchor(baseSegment.start, indexOffset), candles, geometry);
    const baseEnd = projectNativePoint(localAnchor(baseSegment.end, indexOffset), candles, geometry);
    const start = projectNativePoint(localAnchor(parallelSegment.start, indexOffset), candles, geometry);
    const end = projectNativePoint(localAnchor(parallelSegment.end, indexOffset), candles, geometry);
    const reason = objectReason(object, "通道线只覆盖基础趋势线的观察区间，用来衡量过冲和回调质量。");
    return (
      <ObjectGroup object={object} reason={reason} className="channel-object">
        <line
          className="native-drawing-line channel-base"
          data-object-id={`${object.id}-base`}
          x1={baseStart.x}
          y1={baseStart.y}
          x2={baseEnd.x}
          y2={baseEnd.y}
        />
        <line
          className="native-drawing-line channel"
          data-object-id={object.id}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
        />
        <ObjectLabel x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 8} text={object.label} />
      </ObjectGroup>
    );
  }

  if (object.kind === "range_box") {
    const clipped = clipIndexRange(object.start_index, object.end_index, indexOffset, candles.length);
    if (!clipped) {
      return null;
    }
    const localStart = clipped.start - indexOffset;
    const localEnd = clipped.end - indexOffset;
    const top = projectNativePoint({ time_index: localStart, price: object.high }, candles, geometry);
    const bottom = projectNativePoint({ time_index: localEnd, price: object.low }, candles, geometry);
    const x = candleCenterX(localStart, geometry) - geometry.slotWidth / 2;
    const y = Math.min(top.y, bottom.y);
    const width = Math.max((localEnd - localStart + 1) * geometry.slotWidth, geometry.slotWidth);
    const height = Math.max(Math.abs(bottom.y - top.y), 8);
    const reason = objectReason(object, "箱体只覆盖指定 K 线范围，用来标记回调或交易区间边界。");
    return (
      <ObjectGroup object={object} reason={reason} className="range-box-object">
        <rect
          className="native-range-box"
          data-object-id={object.id}
          data-start-candle-index={clipped.start}
          data-end-candle-index={clipped.end}
          x={x}
          y={y}
          width={width}
          height={height}
        />
        <ObjectLabel x={x + 8} y={y + 16} text={object.label} />
      </ObjectGroup>
    );
  }

  if (object.kind === "fibonacci") {
    const segment = clipAnchorSegment(object.start, object.end, indexOffset, candles.length);
    if (!segment) {
      return null;
    }
    const xStart = projectNativePoint(localAnchor(segment.start, indexOffset), candles, geometry).x;
    const xEnd = projectNativePoint(localAnchor(segment.end, indexOffset), candles, geometry).x;
    const [x1, x2] = xStart <= xEnd ? [xStart, xEnd] : [xEnd, xStart];
    const reason = objectReason(object, "斐波那契只映射选定摆动腿的回撤区间，不跨越整张图。");
    return (
      <ObjectGroup object={object} reason={reason} className="fibonacci-object">
        {Object.entries(object.levels).map(([level, price]) => {
          const point = projectNativePoint({ time_index: 0, price }, candles, geometry);
          return (
            <g key={`${object.id}-${level}`}>
              <line
                className="native-drawing-line fib"
                data-object-id={`${object.id}-${level}`}
                x1={x1}
                x2={x2}
                y1={point.y}
                y2={point.y}
              />
              <text className="native-object-label" x={x2 - 34} y={point.y - 4}>
                {level}
              </text>
            </g>
          );
        })}
      </ObjectGroup>
    );
  }

  if (object.kind === "measured_move") {
    const projectionBars = Math.max(1, Math.abs(object.end.time_index - object.start.time_index));
    const targetAnchor = {
      time_index: object.projected_from.time_index + projectionBars,
      price: object.target_price
    };
    const segment = clipAnchorSegment(object.projected_from, targetAnchor, indexOffset, candles.length);
    if (!segment) {
      return null;
    }
    const from = projectNativePoint(localAnchor(segment.start, indexOffset), candles, geometry);
    const target = projectNativePoint(localAnchor(segment.end, indexOffset), candles, geometry);
    const reason = objectReason(object, "等距测量从投射起点到目标价位，只覆盖测量腿对应的 K 线长度。");
    return (
      <ObjectGroup object={object} reason={reason} className="measured-move-object">
        <line
          className="native-drawing-line measured"
          data-object-id={object.id}
          x1={from.x}
          y1={from.y}
          x2={target.x}
          y2={target.y}
        />
        <ObjectLabel x={(from.x + target.x) / 2} y={(from.y + target.y) / 2 - 8} text={object.label} />
      </ObjectGroup>
    );
  }

  if (object.kind === "three_push") {
    const visiblePushes = object.pushes.filter(
      (anchor) => anchor.time_index >= indexOffset && anchor.time_index < indexOffset + candles.length
    );
    if (visiblePushes.length < 2) {
      return null;
    }
    const points = visiblePushes.map((anchor) =>
      projectNativePoint(localAnchor(anchor, indexOffset), candles, geometry)
    );
    const reason = objectReason(object, "三推只连接实际三次推动的 K 线锚点，用来判断动能衰竭。");
    return (
      <ObjectGroup object={object} reason={reason} className="three-push-object">
        <polyline
          className="native-drawing-line push"
          data-object-id={object.id}
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        />
        {points.map((point, index) => (
          <g key={`${object.id}-${index}`} className="push-point">
            <circle cx={point.x} cy={point.y} r={3.4} />
            <text x={point.x + 5} y={point.y - 5}>{`推动${index + 1}`}</text>
          </g>
        ))}
      </ObjectGroup>
    );
  }

  if (object.kind === "trade_marker") {
    return (
      <TradeMarker
        object={object}
        candles={candles}
        indexOffset={indexOffset}
        geometry={geometry}
      />
    );
  }

  return null;
}

function TradeMarker({
  object,
  candles,
  indexOffset,
  geometry
}: {
  object: TradeMarkerObject;
  candles: Candle[];
  indexOffset: number;
  geometry: Geometry;
}) {
  const scoped = clipIndexRange(
    object.start_index ?? object.time_index,
    object.end_index ?? object.time_index + 8,
    indexOffset,
    candles.length
  );
  if (!scoped) {
    return null;
  }
  const localIndex = clamp(object.time_index - indexOffset, 0, candles.length - 1);
  const point = projectNativePoint({ time_index: localIndex, price: object.price }, candles, geometry);
  const startX = candleCenterX(scoped.start - indexOffset, geometry);
  const endX = candleCenterX(scoped.end - indexOffset, geometry);
  const [lineX1, lineX2] = startX <= endX ? [startX, endX] : [endX, startX];
  const label = formatTradeMarkerLabel(object);
  const labelX = clamp(lineX2 - 4, geometry.plotLeft + 112, geometry.plotRight - 8);
  const labelY = clamp(point.y - 7, geometry.plotTop + 14, geometry.plotBottom - 8);
  const labelWidth = Math.min(176, Math.max(88, label.length * 7.6));
  const reason = objectReason(object, "交易标记只覆盖本笔订单的计划观察窗口。");
  const dotVisible = object.time_index >= indexOffset && object.time_index < indexOffset + candles.length;

  return (
    <ObjectGroup object={object} reason={reason} className={`trade-marker ${object.marker_type}`}>
      <line
        className={`trade-price-line ${object.marker_type}`}
        data-candle-index={object.time_index}
        x1={lineX1}
        x2={lineX2}
        y1={point.y}
        y2={point.y}
      />
      {dotVisible ? (
        <circle
          className={`trade-dot ${object.marker_type}`}
          data-candle-index={object.time_index}
          cx={point.x}
          cy={point.y}
          r={4.2}
        />
      ) : null}
      <rect
        className={`trade-marker-label-bg ${object.marker_type}`}
        x={labelX - labelWidth}
        y={labelY - 12}
        width={labelWidth}
        height={20}
        rx={4}
      />
      <text
        className={`trade-marker-label ${object.marker_type}`}
        x={labelX - 8}
        y={labelY + 2}
        textAnchor="end"
      >
        {label}
      </text>
    </ObjectGroup>
  );
}

function ObjectGroup({
  object,
  reason,
  className,
  children
}: {
  object: ChartObject;
  reason: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <g
      className={`anchored-object ${className}`}
      data-object-id={object.id}
      data-reason={reason}
    >
      <title>{`${translateText(object.label)}：${translateText(reason)}`}</title>
      {children}
    </g>
  );
}

function ObjectLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text className="native-object-label" x={x} y={y}>
      {compactChartLabel(translateText(text))}
    </text>
  );
}

function compactChartLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

function AnchorDot({ point, anchor }: { point: { x: number; y: number }; anchor: AnchorPoint }) {
  return (
    <circle
      className="anchor-handle"
      data-candle-index={anchor.time_index}
      data-anchor-price={anchor.price.toFixed(2)}
      cx={point.x}
      cy={point.y}
      r={3.2}
    />
  );
}

function localAnchor(anchor: AnchorPoint, indexOffset: number): AnchorPoint {
  return { ...anchor, time_index: anchor.time_index - indexOffset };
}

function clipAnchorSegment(
  start: AnchorPoint,
  end: AnchorPoint,
  indexOffset: number,
  visibleCount: number
): { start: AnchorPoint; end: AnchorPoint } | null {
  const clipped = clipIndexRange(start.time_index, end.time_index, indexOffset, visibleCount);
  if (!clipped) {
    return null;
  }
  return {
    start: { time_index: clipped.start, price: linePriceAt(start, end, clipped.start) },
    end: { time_index: clipped.end, price: linePriceAt(start, end, clipped.end) }
  };
}

function clipIndexRange(
  startIndex: number,
  endIndex: number,
  indexOffset: number,
  visibleCount: number
): { start: number; end: number } | null {
  const windowStart = indexOffset;
  const windowEnd = indexOffset + visibleCount - 1;
  const rawStart = Math.min(startIndex, endIndex);
  const rawEnd = Math.max(startIndex, endIndex);
  const start = Math.max(rawStart, windowStart);
  const end = Math.min(rawEnd, windowEnd);
  return start <= end ? { start, end } : null;
}

function objectReason(object: ChartObject, fallback: string) {
  const maybeReason = "reason" in object ? object.reason : null;
  return maybeReason?.trim() || fallback;
}

function linePriceAt(start: AnchorPoint, end: AnchorPoint, timeIndex: number) {
  if (end.time_index === start.time_index) {
    return start.price;
  }
  return start.price + ((end.price - start.price) / (end.time_index - start.time_index)) * (timeIndex - start.time_index);
}

function formatTradeMarkerLabel(object: TradeMarkerObject) {
  const label =
    object.marker_type === "entry"
      ? "入场"
      : object.marker_type === "stop"
        ? "止损"
        : object.marker_type === "target"
          ? "止盈"
          : "成交";
  const quantity = object.quantity == null ? "" : ` 仓位 ${object.quantity}`;
  return `${label} ${object.price.toFixed(2)}${quantity}`;
}

function formatTime(timestamp?: string) {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(11, 16);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
