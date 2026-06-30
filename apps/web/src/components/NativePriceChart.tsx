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
  const geometry = createNativeChartGeometry(candles, objects);
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
      aria-label="PAquant数据驱动K线图"
      onWheel={handleWheel}
      onMouseDown={(event) => beginDrag(event.clientX)}
      onMouseUp={(event) => endDrag(event.clientX)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
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

      <g className="native-drawing-layer" aria-label="AI图表标注">
        {objects
          .filter((object) => chartObjectIsVisible(object, indexOffset, candles.length))
          .map((object) => (
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
  geometry: ReturnType<typeof createNativeChartGeometry>;
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
  geometry: ReturnType<typeof createNativeChartGeometry>;
}) {
  if (object.kind === "trendline") {
    const [start, end] = object.anchors.map((anchor) =>
      projectNativePoint(localAnchor(anchor, indexOffset), candles, geometry)
    );
    return (
      <g className="anchored-object trendline-object">
        <line
          className="native-drawing-line trend"
          data-object-id={object.id}
          data-start-candle-index={object.anchors[0].time_index}
          data-end-candle-index={object.anchors[1].time_index}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
        />
        <AnchorDot point={start} anchor={object.anchors[0]} />
        <AnchorDot point={end} anchor={object.anchors[1]} />
      </g>
    );
  }

  if (object.kind === "channel") {
    const [rawStart, rawEnd] = object.base.anchors;
    const offset = object.parallel_anchor.price - linePriceAt(rawStart, rawEnd, object.parallel_anchor.time_index);
    const start = projectNativePoint(
      localAnchor({ ...rawStart, price: rawStart.price + offset }, indexOffset),
      candles,
      geometry
    );
    const end = projectNativePoint(
      localAnchor({ ...rawEnd, price: rawEnd.price + offset }, indexOffset),
      candles,
      geometry
    );
    return (
      <g className="anchored-object channel-object">
        <line
          className="native-drawing-line channel"
          data-object-id={object.id}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
        />
      </g>
    );
  }

  if (object.kind === "range_box") {
    const topLeft = projectNativePoint(
      { time_index: object.start_index - indexOffset, price: object.high },
      candles,
      geometry
    );
    const bottomRight = projectNativePoint(
      { time_index: object.end_index - indexOffset, price: object.low },
      candles,
      geometry
    );
    const x = Math.min(topLeft.x, bottomRight.x);
    const y = Math.min(topLeft.y, bottomRight.y);
    const width = Math.max(Math.abs(bottomRight.x - topLeft.x), geometry.slotWidth);
    const height = Math.max(Math.abs(bottomRight.y - topLeft.y), 8);
    return (
      <g className="anchored-object range-box-object">
        <rect
          className="native-range-box"
          data-object-id={object.id}
          data-start-candle-index={object.start_index}
          data-end-candle-index={object.end_index}
          x={x}
          y={y}
          width={width}
          height={height}
        />
        <text className="native-object-label" x={x + 8} y={y + 16}>
          {translateText(object.label)}
        </text>
      </g>
    );
  }

  if (object.kind === "fibonacci") {
    return (
      <g className="anchored-object fibonacci-object">
        {Object.entries(object.levels).map(([level, price]) => {
          const point = projectNativePoint({ time_index: 0, price }, candles, geometry);
          return (
            <g key={`${object.id}-${level}`}>
              <line
                className="native-drawing-line fib"
                x1={geometry.plotLeft}
                x2={geometry.plotRight}
                y1={point.y}
                y2={point.y}
              />
              <text className="native-object-label" x={geometry.plotRight - 34} y={point.y - 4}>
                {level}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  if (object.kind === "measured_move") {
    const from = projectNativePoint(localAnchor(object.projected_from, indexOffset), candles, geometry);
    const target = projectNativePoint(
      { time_index: object.projected_from.time_index - indexOffset + 12, price: object.target_price },
      candles,
      geometry
    );
    return (
      <line
        className="native-drawing-line measured"
        data-object-id={object.id}
        x1={from.x}
        y1={from.y}
        x2={target.x}
        y2={target.y}
      />
    );
  }

  if (object.kind === "three_push") {
    const points = object.pushes.map((anchor) =>
      projectNativePoint(localAnchor(anchor, indexOffset), candles, geometry)
    );
    return (
      <polyline
        className="native-drawing-line push"
        data-object-id={object.id}
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
      />
    );
  }

  if (object.kind === "trade_marker") {
    if (object.time_index < indexOffset || object.time_index >= indexOffset + candles.length) {
      return null;
    }
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
  geometry: ReturnType<typeof createNativeChartGeometry>;
}) {
  const localIndex = object.time_index - indexOffset;
  const point = projectNativePoint({ time_index: localIndex, price: object.price }, candles, geometry);
  const label = formatTradeMarkerLabel(object);
  const labelX = geometry.plotRight - 14;
  const labelY = clamp(point.y - 7, geometry.plotTop + 14, geometry.plotBottom - 8);
  const labelWidth = Math.min(220, Math.max(96, label.length * 9.2));

  return (
    <g className={`trade-marker ${object.marker_type}`}>
      <title>{translateText(object.reason ?? object.label)}</title>
      <line
        className={`trade-price-line ${object.marker_type}`}
        data-candle-index={object.time_index}
        x1={geometry.plotLeft}
        x2={geometry.plotRight}
        y1={point.y}
        y2={point.y}
      />
      <circle
        className={`trade-dot ${object.marker_type}`}
        data-candle-index={object.time_index}
        cx={point.x}
        cy={point.y}
        r={4.2}
      />
      <rect
        className={`trade-marker-label-bg ${object.marker_type}`}
        x={labelX - labelWidth}
        y={labelY - 14}
        width={labelWidth}
        height={24}
        rx={5}
      />
      <text
        className={`trade-marker-label ${object.marker_type}`}
        x={labelX - 8}
        y={labelY + 2}
        textAnchor="end"
      >
        {label}
      </text>
    </g>
  );
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
