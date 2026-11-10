"use client";

import type { RateHistoryPoint } from "@budgy/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { monthYearShort } from "@/lib/format";

const PAD = { l: 52, r: 16, t: 16, b: 32 };
const pct = (r: number) => `${(r * 100).toFixed(2)}%`;

interface Line {
  name: string;
  color: string;
  values: number[];
}

/**
 * Your rate (flat) against the RBA monthly averages for new and existing loans.
 * The points run oldest to newest, one a month.
 */
export function RateHistoryChart({
  points,
  yours,
  label,
}: {
  points: RateHistoryPoint[];
  yours: number;
  /** What the lines are, for the screen reader. */
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.min(280, Math.max(200, W * 0.4)));
  const n = Math.max(1, points.length - 1);

  const lines: Line[] = useMemo(
    () => [
      {
        name: "Your rate",
        color: "var(--series-a)",
        values: points.map(() => yours),
      },
      {
        name: "Average, existing loans",
        color: "var(--series-base)",
        values: points.map((p) => p.outstanding),
      },
      { name: "Average, new loans", color: "var(--series-b)", values: points.map((p) => p.new) },
    ],
    [points, yours],
  );

  const geo = useMemo(() => {
    const all = lines.flatMap((l) => l.values);
    const lo = Math.max(0, Math.floor((Math.min(...all) - 0.0025) / 0.0025) * 0.0025);
    const hi = Math.ceil((Math.max(...all) + 0.0025) / 0.0025) * 0.0025;
    const span = hi - lo;
    const step = span <= 0.015 ? 0.0025 : span <= 0.03 ? 0.005 : 0.01;
    const xAt = (i: number) => PAD.l + (i / n) * (W - PAD.l - PAD.r);
    const yAt = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const yTicks: number[] = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step)
      yTicks.push(Math.round(v * 10_000) / 10_000);
    // About four labels along the bottom, on January or the first point.
    const every = Math.max(1, Math.round(n / (W < 480 ? 3 : 5)));
    const xTicks: number[] = [];
    for (let i = n; i >= 0; i -= every) xTicks.unshift(i);
    return { xAt, yAt, yTicks, xTicks, step };
  }, [lines, W, H, n]);

  const path = (values: number[]) =>
    values
      .map((v, i) => `${i ? "L" : "M"}${geo.xAt(i).toFixed(1)} ${geo.yAt(v).toFixed(1)}`)
      .join("");

  const last = points.length - 1;
  const shown = hover ?? last;

  return (
    <figure ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-label={`Line chart of ${label}: your rate stays at ${pct(yours)} while the average for new loans goes from ${pct(points[0].new)} to ${pct(points[last].new)} and for existing loans from ${pct(points[0].outstanding)} to ${pct(points[last].outstanding)}, ${monthYearShort(`${points[0].month}-01`)} to ${monthYearShort(`${points[last].month}-01`)}`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * W;
          const t = (x - PAD.l) / (W - PAD.l - PAD.r);
          setHover(t >= 0 && t <= 1 ? Math.round(t * n) : null);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {geo.yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={geo.yAt(v)} y2={geo.yAt(v)} stroke="var(--grid)" />
            <text
              x={PAD.l - 8}
              y={geo.yAt(v) + 4}
              textAnchor="end"
              fontSize="12"
              fill="var(--muted)"
              className="num"
            >
              {`${(v * 100).toFixed(geo.step < 0.005 ? 2 : 1)}%`}
            </text>
          </g>
        ))}
        {geo.xTicks.map((i) => (
          <text
            key={i}
            x={geo.xAt(i)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === n ? "end" : "middle"}
            fontSize="12"
            fill="var(--muted)"
          >
            {monthYearShort(`${points[i].month}-01`)}
          </text>
        ))}
        {lines.map((l, k) => (
          <path
            key={l.name}
            d={path(l.values)}
            fill="none"
            stroke={l.color}
            strokeWidth={k === 0 ? 3 : 2}
            strokeLinejoin="round"
          />
        ))}
        {lines.map((l) => (
          <circle
            key={l.name}
            cx={geo.xAt(shown)}
            cy={geo.yAt(l.values[shown])}
            r="4.5"
            fill={l.color}
            stroke="var(--surface)"
            strokeWidth="2"
          />
        ))}
        {hover !== null && (
          <line
            x1={geo.xAt(hover)}
            x2={geo.xAt(hover)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="var(--muted)"
            strokeDasharray="3 3"
          />
        )}
      </svg>
      <figcaption className="mt-2 flex min-h-6 flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="num text-muted">{monthYearShort(`${points[shown].month}-01`)}:</span>
        {lines.map((l) => (
          <span key={l.name} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1 w-4 rounded-full" style={{ background: l.color }} />
            <span>{l.name}</span>
            <span className="num text-muted">{pct(l.values[shown])}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
