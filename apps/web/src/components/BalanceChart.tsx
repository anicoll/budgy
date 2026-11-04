"use client";

import type { BalancePoint } from "@budgy/engine";

/** Any dated balance: loan simulations and debt plans both draw here. */
type Point = Pick<BalancePoint, "date" | "balance">;

import { useEffect, useMemo, useRef, useState } from "react";
import { money, monthYearShort } from "@/lib/format";

export interface Series {
  name: string;
  color: string;
  points: Point[];
  payoffDate: string;
}

const PAD = { l: 64, r: 16, t: 16, b: 32 };

/** "$0", "$500", "$2.5k", "$600k" from cents. */
function axisMoney(cents: number): string {
  const d = cents / 100;
  if (d < 1_000) return `$${Math.round(d)}`;
  if (d >= 1_000_000) return `$${Number((d / 1_000_000).toFixed(2))}m`;
  return `$${Number((d / 1_000).toFixed(d < 10_000 ? 1 : 0))}k`;
}

const dayOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

function niceStep(max: number): number {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
}

/** Loan balance over time, one line per scenario, payoff marked with a dot. */
export function BalanceChart({
  series,
  label = "Loan balance over time for each scenario",
  markEnd = false,
}: {
  series: Series[];
  label?: string;
  /** Put each series' dot on its last point instead of at $0 (for balances that grow). */
  markEnd?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real pixel width so text stays readable on a phone.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.min(300, Math.max(220, W * 0.5)));

  const geo = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const x0 = Math.min(...all.map((p) => dayOf(p.date)));
    const x1 = Math.max(...all.map((p) => dayOf(p.date)));
    const yMax = Math.max(...all.map((p) => p.balance));
    const step = niceStep(yMax);
    const top = Math.ceil(yMax / step) * step;
    const xAt = (d: number) => PAD.l + ((d - x0) / Math.max(1, x1 - x0)) * (W - PAD.l - PAD.r);
    const yAt = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
    const yTicks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
    const y0 = new Date(x0 * 86_400_000).getUTCFullYear();
    const y1 = new Date(x1 * 86_400_000).getUTCFullYear();
    const span = (y1 - y0) / (W < 480 ? 4 : 6);
    const every = span <= 1 ? 1 : span <= 2 ? 2 : Math.ceil(span / 5) * 5;
    const xTicks: number[] = [];
    for (let y = Math.ceil(y0 / every) * every; y <= y1; y += every) xTicks.push(y);
    return { x0, x1, xAt, yAt, yTicks, xTicks };
  }, [series, W, H]);

  const pathFor = (pts: Point[]) =>
    pts
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${geo.xAt(dayOf(p.date)).toFixed(1)} ${geo.yAt(p.balance).toFixed(1)}`,
      )
      .join("");

  const hoverDay = hover === null ? null : geo.x0 + hover * (geo.x1 - geo.x0);
  const at = (pts: Point[], d: number) => {
    let last = pts[0];
    for (const p of pts) {
      if (dayOf(p.date) > d) break;
      last = p;
    }
    return last;
  };

  return (
    <figure ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={label}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * W;
          const t = (x - PAD.l) / (W - PAD.l - PAD.r);
          setHover(t >= 0 && t <= 1 ? t : null);
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
              {axisMoney(v)}
            </text>
          </g>
        ))}
        {geo.xTicks.map((y) => {
          const x = geo.xAt(Date.UTC(y, 0, 1) / 86_400_000);
          return (
            <text key={y} x={x} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--muted)">
              {y}
            </text>
          );
        })}
        {series.map((s) => (
          <g key={s.name}>
            <path d={pathFor(s.points)} fill="none" stroke={s.color} strokeWidth="2" />
            <circle
              cx={geo.xAt(dayOf(s.payoffDate))}
              cy={geo.yAt(markEnd ? (s.points.at(-1)?.balance ?? 0) : 0)}
              r="4"
              fill={s.color}
              stroke="var(--surface)"
              strokeWidth="1.5"
            />
          </g>
        ))}
        {hoverDay !== null && (
          <line
            x1={geo.xAt(hoverDay)}
            x2={geo.xAt(hoverDay)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="var(--muted)"
            strokeDasharray="3 3"
          />
        )}
      </svg>
      <figcaption className="mt-2 flex min-h-12 flex-wrap gap-x-4 gap-y-1 text-sm">
        {series.map((s) => {
          const p = hoverDay === null ? null : at(s.points, hoverDay);
          return (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: s.color }}
              />
              <span>{s.name}</span>
              {p && (
                <span className="num text-muted">
                  {money(p.balance)} in {monthYearShort(p.date)}
                </span>
              )}
            </span>
          );
        })}
      </figcaption>
    </figure>
  );
}
