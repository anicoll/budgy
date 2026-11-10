/** Result of keeping a typed number inside a field's allowed range. */
export interface Clamped {
  value: number;
  /** Plain-English note when the value had to move, otherwise null. */
  hint: string | null;
}

const UNIT_WORDS: Record<string, string> = { yrs: "years" };

/** Joins a number and a field's suffix: "40 years", "12%", "$5,000". */
function withUnit(n: number, suffix: string | undefined, format: (n: number) => string): string {
  const s = format(n);
  if (!suffix) return s;
  const unit = UNIT_WORDS[suffix] ?? suffix;
  if (unit === "%") return `${s}%`;
  return `${s} ${n === 1 && unit.endsWith("s") ? unit.slice(0, -1) : unit}`;
}

/**
 * Keeps `n` within min..max and says so when it moved, so a field never
 * changes what someone typed without a word.
 */
export function clampWithHint(
  n: number,
  min: number,
  max: number,
  suffix?: string,
  format: (n: number) => string = (x) => String(x),
): Clamped {
  if (n > max) {
    return {
      value: max,
      hint: `Capped at ${withUnit(max, suffix, format)}, the most this tool handles.`,
    };
  }
  if (n < min) {
    return {
      value: min,
      hint: `Raised to ${withUnit(min, suffix, format)}, the least this tool handles.`,
    };
  }
  return { value: n, hint: null };
}
