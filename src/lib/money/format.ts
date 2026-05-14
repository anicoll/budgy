import type { Cents } from "./cents";

const AUD_FORMATTER = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const AUD_COMPACT_FORMATTER = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const PCT_FORMATTER = new Intl.NumberFormat("en-AU", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

export function formatAUD(c: Cents): string {
  return AUD_FORMATTER.format(c / 100);
}

export function formatAUDCompact(c: Cents): string {
  return AUD_COMPACT_FORMATTER.format(c / 100);
}

export function formatSigned(c: Cents): string {
  if (c === 0) return formatAUD(c);
  if (c > 0) return `+${formatAUD(c)}`;
  return `-${formatAUD(Math.abs(c) as Cents)}`;
}

export function formatPercent(decimal: number): string {
  return PCT_FORMATTER.format(decimal);
}

export function parseAUDInput(raw: string): Cents | null {
  const trimmed = raw.trim().replace(/[\s,$]/g, "");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) as Cents;
}
