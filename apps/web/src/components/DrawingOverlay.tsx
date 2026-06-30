import { projectToOverlay, type OverlayPoint } from "../lib/chartTransforms";
import { translateText } from "../lib/displayText";
import type { Candle, ChartObject } from "../lib/workbenchTypes";

interface DrawingOverlayProps {
  candles: Candle[];
  objects: ChartObject[];
  indexOffset?: number;
}

function pointPair(
  object: Extract<ChartObject, { kind: "trendline" }>,
  candles: Candle[],
  indexOffset: number
) {
  return object.anchors.map((anchor) =>
    projectAnchorToOverlay(shiftAnchor(anchor, indexOffset), candles)
  );
}

function linePriceAt(start: { time_index: number; price: number }, end: { time_index: number; price: number }, timeIndex: number) {
  if (end.time_index === start.time_index) {
    return start.price;
  }
  const slope = (end.price - start.price) / (end.time_index - start.time_index);
  return start.price + slope * (timeIndex - start.time_index);
}

function channelPair(
  object: Extract<ChartObject, { kind: "channel" }>,
  candles: Candle[],
  indexOffset: number
) {
  const [rawStart, rawEnd] = object.base.anchors;
  const rawAnchorLinePrice = linePriceAt(rawStart, rawEnd, object.parallel_anchor.time_index);
  const offset = object.parallel_anchor.price - rawAnchorLinePrice;
  const start = shiftAnchor(rawStart, indexOffset);
  const end = shiftAnchor(rawEnd, indexOffset);
  return [
    projectAnchorToOverlay({ time_index: start.time_index, price: start.price + offset }, candles),
    projectAnchorToOverlay({ time_index: end.time_index, price: end.price + offset }, candles)
  ];
}

export function DrawingOverlay({ candles, objects, indexOffset = 0 }: DrawingOverlayProps) {
  return (
    <svg
      className="drawing-overlay"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-label="AI图表标注"
      role="img"
    >
      {objects.map((object) => {
        if (object.kind === "trendline") {
          const [start, end] = pointPair(object, candles, indexOffset);
          return (
            <g key={object.id} className="anchored-object trendline-object">
              <line
                className={overlayLineClassName("trend", [start, end])}
                data-object-id={object.id}
                data-anchor-start={formatAnchor(object.anchors[0])}
                data-anchor-end={formatAnchor(object.anchors[1])}
                data-start-candle-index={object.anchors[0].time_index}
                data-end-candle-index={object.anchors[1].time_index}
                data-start-price={object.anchors[0].price.toFixed(2)}
                data-end-price={object.anchors[1].price.toFixed(2)}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
              />
              <AnchorHandle point={start} anchor={object.anchors[0]} />
              <AnchorHandle point={end} anchor={object.anchors[1]} />
            </g>
          );
        }

        if (object.kind === "channel") {
          const [start, end] = channelPair(object, candles, indexOffset);
          return (
            <g key={object.id} className="anchored-object channel-object">
              <line
                className={overlayLineClassName("channel", [start, end])}
                data-object-id={object.id}
                data-anchor-start={formatAnchor(object.base.anchors[0])}
                data-anchor-end={formatAnchor(object.base.anchors[1])}
                data-start-candle-index={object.base.anchors[0].time_index}
                data-end-candle-index={object.base.anchors[1].time_index}
                data-start-price={object.base.anchors[0].price.toFixed(2)}
                data-end-price={object.base.anchors[1].price.toFixed(2)}
                data-parallel-candle-index={object.parallel_anchor.time_index}
                data-parallel-price={object.parallel_anchor.price.toFixed(2)}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
              />
              <AnchorHandle point={start} anchor={object.base.anchors[0]} />
              <AnchorHandle point={end} anchor={object.base.anchors[1]} />
            </g>
          );
        }

        if (object.kind === "range_box") {
          const top = projectAnchorToOverlay({ time_index: object.start_index - indexOffset, price: object.high }, candles);
          const bottom = projectAnchorToOverlay({ time_index: object.end_index - indexOffset, price: object.low }, candles);
          const width = Math.max(bottom.x - top.x, 3);
          const height = Math.max(bottom.y - top.y, 3);
          const labelX = clamp(top.x + 1.4, 2, 92);
          const labelY = clamp(top.y + 3.2, 4, 96);
          return (
            <g key={object.id} className="anchored-object range-box-object">
              <rect
                className="overlay-box"
                data-object-id={object.id}
                data-anchor-start={`${object.start_index}:${object.high.toFixed(2)}`}
                data-anchor-end={`${object.end_index}:${object.low.toFixed(2)}`}
                data-start-candle-index={object.start_index}
                data-end-candle-index={object.end_index}
                data-high-price={object.high.toFixed(2)}
                data-low-price={object.low.toFixed(2)}
                x={top.x}
                y={top.y}
                width={width}
                height={height}
              />
              <text className="overlay-box-title" data-label-size="compact" x={labelX} y={labelY}>
                {translateText(object.label)}
              </text>
              <AnchorHandle point={top} anchor={{ time_index: object.start_index, price: object.high }} />
              <AnchorHandle point={bottom} anchor={{ time_index: object.end_index, price: object.low }} />
            </g>
          );
        }

        if (object.kind === "fibonacci") {
          return Object.entries(object.levels).map(([level, price]) => {
            const projected = projectAnchorToOverlay(
              { time_index: object.end.time_index - indexOffset, price },
              candles
            );
            return (
              <g key={`${object.id}-${level}`}>
                 <line className={overlayLineClassName("fib", [projected])} x1={8} y1={projected.y} x2={94} y2={projected.y} />
                <text className="overlay-text" x={95} y={projected.y}>
                  {level}
                </text>
              </g>
            );
          });
        }

        if (object.kind === "measured_move") {
          const projectedFrom = shiftAnchor(object.projected_from, indexOffset);
          const target = projectAnchorToOverlay(
            { time_index: projectedFrom.time_index + 16, price: object.target_price },
            candles
          );
          const from = projectAnchorToOverlay(projectedFrom, candles);
          return (
            <line
              key={object.id}
              className={overlayLineClassName("measured", [from, target])}
              x1={from.x}
              y1={from.y}
              x2={target.x}
              y2={target.y}
            />
          );
        }

        if (object.kind === "three_push") {
          const points = object.pushes.map((anchor) =>
            projectAnchorToOverlay(shiftAnchor(anchor, indexOffset), candles)
          );
          return (
            <polyline
              key={object.id}
              className={overlayLineClassName("push", points)}
              points={points.map((point) => `${point.x},${point.y}`).join(" ")}
            />
          );
        }

        if (object.kind === "trade_marker") {
          if (!isIndexInWindow(object.time_index, candles, indexOffset)) {
            return null;
          }
          const point = projectToOverlay(
            { time_index: object.time_index - indexOffset, price: object.price },
            candles
          );
          const yOffset = object.marker_type === "stop" ? 4.2 : -2.4;
          const labelPosition = markerLabelPosition(point.x);
          const label = formatTradeMarkerLabel(object);
          const reasonText = object.reason ? formatTradeMarkerReason(object) : null;
          const markerY = clamp(point.y, 4, 88);
          const labelY = Math.max(5, Math.min(markerY + yOffset, 91));
          const frame = markerLabelFrame(
            labelPosition.x,
            labelPosition.anchor,
            labelY,
            label,
            reasonText
          );
          return (
            <g key={object.id} className={`trade-marker ${object.marker_type}`}>
              <title>{translateText(object.reason ?? object.label)}</title>
              <line
                className={`trade-price-line ${object.marker_type}`}
                x1={2}
                y1={markerY}
                x2={97}
                y2={markerY}
              />
              <text
                className={`trade-marker-price-tag ${object.marker_type}`}
                x={96}
                y={clamp(markerY - 1.15, 5, 86)}
                textAnchor="end"
              >
                {label}
              </text>
              <line
                className={`trade-marker-leader ${object.marker_type}`}
                x1={point.x}
                y1={markerY}
                x2={frame.leaderX}
                y2={frame.labelY - 1.1}
              />
              <circle
                className={`trade-dot ${object.marker_type}`}
                cx={point.x}
                cy={markerY}
                r={1.15}
              />
              <rect
                className={`trade-marker-label-bg ${object.marker_type}`}
                x={frame.x}
                y={frame.y}
                width={frame.width}
                height={frame.height}
                rx={0.85}
              />
              <text
                className={`trade-marker-label ${object.marker_type}`}
                x={frame.textX}
                y={frame.labelY}
                textAnchor={labelPosition.anchor}
              >
                {label}
              </text>
              {reasonText ? (
                <text
                  className="trade-marker-reason"
                  x={frame.textX}
                  y={frame.reasonY}
                  textAnchor={labelPosition.anchor}
                >
                  {reasonText}
                </text>
              ) : null}
            </g>
          );
        }

        return null;
      })}
    </svg>
  );
}

function AnchorHandle({
  point,
  anchor
}: {
  point: OverlayPoint;
  anchor?: { time_index: number; price: number };
}) {
  return (
    <circle
      className="anchor-handle"
      data-candle-index={anchor?.time_index}
      data-anchor-price={anchor?.price.toFixed(2)}
      cx={point.x}
      cy={point.y}
      r={0.7}
    />
  );
}

function shiftAnchor(anchor: { time_index: number; price: number }, indexOffset: number) {
  return { ...anchor, time_index: anchor.time_index - indexOffset };
}

function projectAnchorToOverlay(anchor: { time_index: number; price: number }, candles: Candle[]) {
  return projectToOverlay(snapAnchorToVisibleCandle(anchor, candles), candles);
}

function snapAnchorToVisibleCandle(anchor: { time_index: number; price: number }, candles: Candle[]) {
  const index = Math.round(anchor.time_index);
  if (index < 0 || index >= candles.length) {
    return anchor;
  }
  const candle = candles[index];
  return {
    time_index: index,
    price: clamp(anchor.price, candle.low, candle.high)
  };
}

function formatAnchor(anchor: { time_index: number; price: number }) {
  return `${anchor.time_index}:${anchor.price.toFixed(2)}`;
}

function isIndexInWindow(timeIndex: number, candles: Candle[], indexOffset: number) {
  return timeIndex >= indexOffset && timeIndex < indexOffset + candles.length;
}

function overlayLineClassName(kind: string, points: OverlayPoint[]) {
  return ["overlay-line", kind, points.some((point) => point.clamped) ? "clamped" : ""]
    .filter(Boolean)
    .join(" ");
}

function markerLabelPosition(x: number): { x: number; anchor: "start" | "end" } {
  if (x > 58) {
    return { x: Math.max(28, x - 1.8), anchor: "end" };
  }
  return { x: Math.min(70, x + 1.8), anchor: "start" };
}

function markerLabelFrame(
  x: number,
  anchor: "start" | "end",
  labelY: number,
  label: string,
  reasonText: string | null
) {
  const textWidth = Math.max(label.length * 0.92, reasonText ? reasonText.length * 0.62 : 0);
  const width = Math.min(42, Math.max(15, textWidth + 2.4));
  const height = reasonText ? 6.35 : 3.7;
  const rawX = anchor === "end" ? x - width - 0.8 : x - 0.8;
  const rectX = clamp(rawX, 1.2, 98.8 - width);
  const rectY = clamp(labelY - 2.75, 2.2, 97.8 - height);
  const textX = anchor === "end" ? Math.min(x, rectX + width - 1.15) : Math.max(x, rectX + 1.15);
  return {
    x: rectX,
    y: rectY,
    width,
    height,
    textX,
    labelY: rectY + 2.75,
    reasonY: rectY + 5.35,
    leaderX: anchor === "end" ? rectX + width : rectX
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatTradeMarkerLabel(object: Extract<ChartObject, { kind: "trade_marker" }>) {
  const quantity = object.quantity == null ? "" : ` 仓位 ${object.quantity}`;
  const label =
    object.marker_type === "entry"
      ? "入场"
      : object.marker_type === "stop"
        ? "止损"
        : object.marker_type === "target"
          ? "止盈"
          : "成交";
  return `${label} ${object.price.toFixed(2)}${quantity}`;
}

function formatTradeMarkerReason(object: Extract<ChartObject, { kind: "trade_marker" }>) {
  if (object.reason) {
    return `理由：${object.reason.replace(/^入场标记：/, "")}`;
  }
  if (object.marker_type === "entry") {
    return "理由：入场计划";
  }
  if (object.marker_type === "stop") {
    return "理由：摆动失效";
  }
  if (object.marker_type === "target") {
    return "理由：2R止盈";
  }
  return "理由：模拟成交";
}
