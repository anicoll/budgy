"use client";

import type { RefinancePoint } from "@budgy/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { money, monthYearShort } from "@/lib/format";

const PAD = { l: 64, r: 16, t: 16, b: 32 };

function niceStep(span: number): number {
  const raw = span / 4;
  if (raw <= 0) return 100_000;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
}

const tickLabel = (v: number) => {
  const d = v / 100;
  if (d === 0) return "$0";
  const sign = d < 0 ? "−" : "";
  const a = Math.abs(d);
  return a >= 1000 ? `${sign}$${Math.round(a / 100) / 10}k` : `${sign}$${Math.round(a)}`;
};

/**
 * How far ahead (or behind) switching leaves you, month by month. One line,
 * a zero line, and a dot where it breaks even.
 */
export function BenefitChart({
  points,
  breakEvenMonth,
}: {
  points: RefinancePoint[];
  breakEvenMonth: number | null;
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
  const H = Math.round(Math.min(280, Math.max(200, W * 0.45)));

  const geo = useMemo(() => {
    const vals = points.map((p) => p.benefit as number);
    const lo = Math.min(0, ...vals);
    const hi = Math.max(0, ...vals);
    const step = niceStep(hi - lo);
    // Snap the top to a tick, but let a small dip below $0 keep its own scale.
    const top = Math.max(Math.ceil(hi / step) * step, step);
    const bottom = lo < 0 ? Math.min(lo * 1.15, -step / 4) : 0;
    const n = Math.max(1, points.length - 1);
    const xAt = (i: number) => PAD.l + (i / n) * (W - PAD.l - PAD.r);
    const yAt = (v: number) => PAD.t + (1 - (v - bottom) / (top - bottom)) * (H - PAD.t - PAD.b);
    const yTicks: number[] = [];
    for (let v = Math.ceil(bottom / step) * step; v <= top + 1; v += step) yTicks.push(v);
    // Year ticks, spaced to fit.
    const years = n / 12;
    const every = years <= 6 ? 1 : Math.max(1, Math.ceil(years / (W < 480 ? 4 : 6) / 5) * 5);
    const xTicks: number[] = [];
    for (let y = every; y * 12 <= n; y += every) xTicks.push(y * 12);
    return { xAt, yAt, yTicks, xTicks, n };
  }, [points, W, H]);

  const path = points
    .map((p, i) => `${i ? "L" : "M"}${geo.xAt(i).toFixed(1)} ${geo.yAt(p.benefit).toFixed(1)}`)
    .join("");
  const shown = hover === null ? null : points[hover];
  const be = breakEvenMonth !== null && breakEvenMonth < points.length ? breakEvenMonth : null;

  return (
    <figure ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label="How far ahead switching leaves you over time"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * W;
          const t = (x - PAD.l) / (W - PAD.l - PAD.r);
          setHover(t >= 0 && t <= 1 ? Math.round(t * geo.n) : null);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {geo.yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={geo.yAt(v)}
              y2={geo.yAt(v)}
              stroke={v === 0 ? "var(--muted)" : "var(--grid)"}
            />
            <text
              x={PAD.l - 8}
              y={geo.yAt(v) + 4}
              textAnchor="end"
              fontSize="12"
              fill="var(--muted)"
              className="num"
            >
              {tickLabel(v)}
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
        <path d={path} fill="none" stroke="var(--series-a)" strokeWidth="2" />
        {be !== null && (
          <circle
            cx={geo.xAt(be)}
            cy={geo.yAt(points[be].benefit)}
            r="5"
            fill="var(--series-a)"
            stroke="var(--surface)"
            strokeWidth="2"
          />
        )}
        {shown && hover !== null && (
          <>
            <line
              x1={geo.xAt(hover)}
              x2={geo.xAt(hover)}
              y1={PAD.t}
              y2={H - PAD.b}
              stroke="var(--muted)"
              strokeDasharray="3 3"
            />
            <circle
              cx={geo.xAt(hover)}
              cy={geo.yAt(shown.benefit)}
              r="4"
              fill="var(--series-a)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          </>
        )}
      </svg>
      <figcaption className="num mt-2 min-h-6 text-sm text-muted">
        {shown ? (
          <>
            {monthYearShort(shown.date)}:{" "}
            <span className={shown.benefit >= 0 ? "text-good" : "text-warn"}>
              {shown.benefit >= 0
                ? `${money(shown.benefit)} ahead`
                : `${money(-shown.benefit)} behind`}
            </span>
          </>
        ) : (
          "Point at the chart to see any month."
        )}
      </figcaption>
    </figure>
  );
}
