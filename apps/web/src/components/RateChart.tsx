"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { monthYearShort } from "@/lib/format";

export interface RateSeries {
  name: string;
  color: string;
  dashed?: boolean;
  /** The rate for each month from 0, as a fraction (0.06). */
  rates: number[];
}

const PAD = { l: 52, r: 16, t: 16, b: 32 };
const pct = (r: number) => `${(r * 100).toFixed(2)}%`;

/** Interest rates over time as step lines: the variable path and the plan. */
export function RateChart({
  series,
  dates,
  markerMonth,
}: {
  series: RateSeries[];
  /** The date of each month index. */
  dates: string[];
  /** A dashed upright at this month (the end of the fixed period). */
  markerMonth?: number;
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
  const H = Math.round(Math.min(220, Math.max(160, W * 0.32)));
  const n = Math.max(1, dates.length - 1);

  const geo = useMemo(() => {
    const all = series.flatMap((s) => s.rates);
    // Quarter-percent grid, with a little room above and below.
    const lo = Math.max(0, Math.floor((Math.min(...all) - 0.0025) / 0.0025) * 0.0025);
    const hi = Math.ceil((Math.max(...all) + 0.0025) / 0.0025) * 0.0025;
    const span = hi - lo;
    const step = span <= 0.015 ? 0.0025 : span <= 0.03 ? 0.005 : 0.01;
    const xAt = (i: number) => PAD.l + (i / n) * (W - PAD.l - PAD.r);
    const yAt = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const yTicks: number[] = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step)
      yTicks.push(Math.round(v * 10_000) / 10_000);
    const years = n / 12;
    const every = years <= 6 ? 1 : Math.max(1, Math.ceil(years / (W < 480 ? 4 : 6) / 5) * 5);
    const xTicks: number[] = [];
    for (let y = every; y * 12 <= n; y += every) xTicks.push(y * 12);
    return { xAt, yAt, yTicks, xTicks, step };
  }, [series, W, H, n]);

  const stepPath = (rates: number[]) => {
    let d = `M${geo.xAt(0).toFixed(1)} ${geo.yAt(rates[0]).toFixed(1)}`;
    for (let i = 1; i < rates.length; i++) {
      d += `H${geo.xAt(i).toFixed(1)}`;
      if (rates[i] !== rates[i - 1]) d += `V${geo.yAt(rates[i]).toFixed(1)}`;
    }
    return d;
  };

  return (
    <figure ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label="Interest rates over time on each option"
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
        {geo.xTicks.map((m) => (
          <text
            key={m}
            x={geo.xAt(m)}
            y={H - 8}
            textAnchor="middle"
            fontSize="12"
            fill="var(--muted)"
          >
            {m / 12}y
          </text>
        ))}
        {markerMonth !== undefined && markerMonth <= n && (
          <line
            x1={geo.xAt(markerMonth)}
            x2={geo.xAt(markerMonth)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="var(--muted)"
            strokeDasharray="2 4"
          />
        )}
        {series.map((s) => (
          <path
            key={s.name}
            d={stepPath(s.rates)}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeDasharray={s.dashed ? "6 4" : undefined}
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
        {hover !== null && <span className="num text-muted">{monthYearShort(dates[hover])}:</span>}
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: s.color }}
            />
            <span>{s.name}</span>
            {hover !== null && <span className="num text-muted">{pct(s.rates[hover])}</span>}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
