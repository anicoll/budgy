import { cn } from "@/lib/utils";

interface Point {
  balance: number;
}

interface Props {
  points: Point[];
  className?: string;
  /** Stroke colour (any CSS colour). Defaults to a violet that matches the accent. */
  color?: string;
}

/**
 * Tiny inline SVG sparkline. Renders an area + polyline of balance over time.
 * Auto-scales to the min/max of `points`. Zero is included in the range so a
 * flat-near-zero series doesn't visually look like wild swings.
 */
export function BalanceSparkline({ points, className, color = "rgb(167 139 250)" }: Props) {
  if (points.length < 2) return null;

  const values = points.map((p) => p.balance);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;

  const W = 100;
  const H = 24;
  const dx = W / (points.length - 1);

  const coords = values.map((v, i) => {
    const x = i * dx;
    const y = H - ((v - min) / range) * H;
    return [x, y] as const;
  });

  const line = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("h-6 w-full", className)}
      role="img"
    >
      <title>Balance trend over last {points.length} periods</title>
      <path d={area} fill={color} opacity={0.18} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
