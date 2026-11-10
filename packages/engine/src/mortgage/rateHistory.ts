import { RBA_HOUSING_HISTORY, type RbaHousingHistory } from "./rbaHistory";
import type { LoanPurpose, RateSeries } from "./rbaRates";

/**
 * The RBA average rates month by month, for charting a rate against them.
 * Rates are decimals: 0.0615 is 6.15% a year.
 */

export interface RateHistoryPoint {
  /** YYYY-MM. */
  month: string;
  /** Average on new loans funded that month. */
  new: number;
  /** Average on all outstanding loans at the end of that month. */
  outstanding: number;
}

function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * The last `months` months of averages plus the month they start from, so
 * `months + 1` points (a year is 13 points, 12 steps). Fewer if the history
 * is shorter. Empty if there is none.
 */
export function averageRateHistory(
  purpose: LoanPurpose,
  series: RateSeries,
  months: number,
  data: RbaHousingHistory = RBA_HOUSING_HISTORY,
): RateHistoryPoint[] {
  const h = data.rates[purpose][series];
  const count = Math.min(h.new.length, h.outstanding.length);
  const from = Math.max(0, count - (Math.max(0, Math.floor(months)) + 1));
  const points: RateHistoryPoint[] = [];
  for (let i = from; i < count; i++)
    points.push({ month: addMonths(data.first, i), new: h.new[i], outstanding: h.outstanding[i] });
  return points;
}

export interface GapChange {
  /** Your rate less the average at the start of the range. Positive: you pay more. */
  from: number;
  /** The same at the end of the range. */
  to: number;
  /** `widened` if you moved further above (or less below) the average. */
  direction: "widened" | "narrowed" | "same";
}

/** A move in the gap smaller than this counts as unchanged. */
export const GAP_CHANGE_STEP = 0.0005;

/**
 * How your rate's gap to an average has changed across the points, holding
 * your rate flat. Null with fewer than two points.
 */
export function gapChange(
  points: RateHistoryPoint[],
  yourRate: number,
  benchmark: "new" | "outstanding",
): GapChange | null {
  if (points.length < 2) return null;
  const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
  const from = round6(yourRate - points[0][benchmark]);
  const to = round6(yourRate - points[points.length - 1][benchmark]);
  const diff = round6(to - from);
  const direction =
    diff > GAP_CHANGE_STEP ? "widened" : diff < -GAP_CHANGE_STEP ? "narrowed" : "same";
  return { from, to, direction };
}
