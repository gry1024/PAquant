import { projectToOverlay } from "../lib/chartTransforms";
import type { Candle, ChartObject } from "../lib/workbenchTypes";

interface DrawingOverlayProps {
  candles: Candle[];
  objects: ChartObject[];
}

function pointPair(object: Extract<ChartObject, { kind: "trendline" }>, candles: Candle[]) {
  return object.anchors.map((anchor) => projectToOverlay(anchor, candles));
}

export function DrawingOverlay({ candles, objects }: DrawingOverlayProps) {
  return (
    <svg className="drawing-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
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
          return (
            <circle
              key={object.id}
              className={`trade-dot ${object.marker_type}`}
              cx={point.x}
              cy={point.y}
              r={1.15}
            />
          );
        }

        return null;
      })}
    </svg>
  );
}
