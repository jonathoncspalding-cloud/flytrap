/**
 * SparkLine — lightweight inline SVG sparkline for CPS history.
 * Shows the last N data points as a simple line chart.
 * No dependencies — pure SVG path math.
 */
"use client";

interface SparkLineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Color override — defaults to a gradient based on last value. */
  color?: string;
  /** Show a dot at the latest value */
  showEndDot?: boolean;
}

function cpsSparkColor(lastValue: number): string {
  if (lastValue >= 80) return "#4ade80";
  if (lastValue >= 60) return "#86efac";
  if (lastValue >= 40) return "#fbbf24";
  return "rgba(255,255,255,0.3)";
}

export default function SparkLine({
  data,
  width = 64,
  height = 24,
  color,
  showEndDot = true,
}: SparkLineProps) {
  if (!data || data.length < 2) {
    // Not enough data — render a faint placeholder dash
    return (
      <svg width={width} height={height} style={{ display: "block" }}>
        <line
          x1={0} y1={height / 2}
          x2={width} y2={height / 2}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  const min    = Math.min(...data);
  const max    = Math.max(...data);
  const range  = max - min || 1;   // avoid div-by-zero when all values equal
  const pad    = 3;                 // vertical padding so dots aren't clipped

  // Map each data point to (x, y) coordinates
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = pad + ((1 - (v - min) / range) * (height - pad * 2));
    return { x, y };
  });

  // Build SVG polyline points string
  const polylinePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Build a filled area path (line + bottom close)
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  const last      = data[data.length - 1];
  const lineColor = color ?? cpsSparkColor(last);
  const lastPt    = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Area fill */}
      <path
        d={areaPath}
        fill={lineColor}
        fillOpacity={0.08}
      />
      {/* Line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {showEndDot && (
        <circle
          cx={lastPt.x.toFixed(1)}
          cy={lastPt.y.toFixed(1)}
          r={2.5}
          fill={lineColor}
        />
      )}
    </svg>
  );
}
