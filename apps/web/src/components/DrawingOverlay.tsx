import { projectToOverlay } from "../lib/chartTransforms";
import type { Candle, ChartObject } from "../lib/workbenchTypes";

interface DrawingOverlayProps {
  candles: Candle[];
  objects: ChartObject[];
}

function pointPair(object: Extract<ChartObject, { kind: "trendline" }>, candles: Candle[]) {
  return object.anchors.map((anchor) => projectToOverlay(anchor, candles));
}

function linePriceAt(start: { time_index: number; price: number }, end: { time_index: number; price: number }, timeIndex: number) {
  if (end.time_index === start.time_index) {
    return start.price;
  }
  const slope = (end.price - start.price) / (end.time_index - start.time_index);
  return start.price + slope * (timeIndex - start.time_index);
}

function channelPair(object: Extract<ChartObject, { kind: "channel" }>, candles: Candle[]) {
  const [start, end] = object.base.anchors;
  const anchorLinePrice = linePriceAt(start, end, object.parallel_anchor.time_index);
  const offset = object.parallel_anchor.price - anchorLinePrice;
  return [
    projectToOverlay({ time_index: start.time_index, price: start.price + offset }, candles),
    projectToOverlay({ time_index: end.time_index, price: end.price + offset }, candles)
  ];
}

export function DrawingOverlay({ candles, objects }: DrawingOverlayProps) {
  return (
    <svg
      className="drawing-overlay"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-label="AI chart annotations"
      role="img"
    >
      {objects.map((object) => {
        if (object.kind === "trendline") {
          const [start, end] = pointPair(object, candles);
          return (
            <line
              key={object.id}
              className="overlay-line trend"
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
            />
          );
        }

        if (object.kind === "channel") {
          const [start, end] = channelPair(object, candles);
          return (
            <line
              key={object.id}
              className="overlay-line channel"
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
            />
          );
        }

        if (object.kind === "range_box") {
          const top = projectToOverlay({ time_index: object.start_index, price: object.high }, candles);
          const bottom = projectToOverlay({ time_index: object.end_index, price: object.low }, candles);
          return (
            <rect
              key={object.id}
              className="overlay-box"
              x={top.x}
              y={top.y}
              width={Math.max(bottom.x - top.x, 3)}
              height={Math.max(bottom.y - top.y, 3)}
            />
          );
        }

        if (object.kind === "fibonacci") {
          return Object.entries(object.levels).map(([level, price]) => {
            const projected = projectToOverlay({ time_index: object.end.time_index, price }, candles);
            return (
              <g key={`${object.id}-${level}`}>
                <line className="overlay-line fib" x1={8} y1={projected.y} x2={94} y2={projected.y} />
                <text className="overlay-text" x={95} y={projected.y}>
                  {level}
                </text>
              </g>
            );
          });
        }

        if (object.kind === "measured_move") {
          const target = projectToOverlay(
            { time_index: object.projected_from.time_index + 16, price: object.target_price },
            candles
          );
          const from = projectToOverlay(object.projected_from, candles);
          return (
            <line
              key={object.id}
              className="overlay-line measured"
              x1={from.x}
              y1={from.y}
              x2={target.x}
              y2={target.y}
            />
          );
        }

        if (object.kind === "three_push") {
          const points = object.pushes.map((anchor) => projectToOverlay(anchor, candles));
          return (
            <polyline
              key={object.id}
              className="overlay-line push"
              points={points.map((point) => `${point.x},${point.y}`).join(" ")}
            />
          );
        }

        if (object.kind === "trade_marker") {
          const point = projectToOverlay(
            { time_index: object.time_index, price: object.price },
            candles
          );
          const yOffset = object.marker_type === "stop" ? 4.2 : -2.4;
          const labelPosition = markerLabelPosition(point.x);
          return (
            <g key={object.id} className={`trade-marker ${object.marker_type}`}>
              <title>{object.reason ?? object.label}</title>
              <circle
                className={`trade-dot ${object.marker_type}`}
                cx={point.x}
                cy={point.y}
                r={1.15}
              />
              <text
                className={`trade-marker-label ${object.marker_type}`}
                x={labelPosition.x}
                y={Math.max(5, Math.min(point.y + yOffset, 95))}
                textAnchor={labelPosition.anchor}
              >
                {formatTradeMarkerLabel(object)}
              </text>
              {object.reason ? (
                <text
                  className="trade-marker-reason"
                  x={labelPosition.x}
                  y={Math.max(8, Math.min(point.y + yOffset + 3.4, 98))}
                  textAnchor={labelPosition.anchor}
                >
                  {formatTradeMarkerReason(object.marker_type)}
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

function markerLabelPosition(x: number): { x: number; anchor: "start" | "end" } {
  if (x > 58) {
    return { x: Math.max(28, x - 1.8), anchor: "end" };
  }
  return { x: Math.min(70, x + 1.8), anchor: "start" };
}

function formatTradeMarkerLabel(object: Extract<ChartObject, { kind: "trade_marker" }>) {
  const quantity = object.quantity == null ? "" : ` size ${object.quantity}`;
  const label = object.marker_type === "entry" ? "Entry" : object.marker_type === "stop" ? "Stop" : "Target";
  return `${label} ${object.price.toFixed(2)}${quantity}`;
}

function formatTradeMarkerReason(markerType: "entry" | "stop" | "target" | "fill") {
  if (markerType === "entry") {
    return "Reason: pullback thesis";
  }
  if (markerType === "stop") {
    return "Reason: swing invalidation";
  }
  if (markerType === "target") {
    return "Reason: 2R measured reward";
  }
  return "Reason: simulated fill";
}
