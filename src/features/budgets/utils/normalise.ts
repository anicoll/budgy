import type { Cents } from "@/lib/money/cents";

export type BudgetFrequency = "weekly" | "fortnightly" | "monthly" | "yearly";

// How many occurrences per year for each frequency.
// Uses exact statutory counts (52 weeks, 26 fortnights, 12 months).
const PER_YEAR: Record<BudgetFrequency, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  yearly: 1,
};

export const FREQUENCY_LABEL: Record<BudgetFrequency, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  yearly: "Yearly",
};

/**
 * Convert an amount from its native frequency to a target viewing period.
 * Converts via annual equivalent to avoid compounding rounding errors.
 *
 * Examples:
 *   normaliseToPeriod(10000, "weekly", "monthly")      → 43333  ($100/wk → $433.33/mo)
 *   normaliseToPeriod(350000, "fortnightly", "monthly") → 758333 ($3,500/fn → $7,583.33/mo)
 *   normaliseToPeriod(180000, "monthly", "weekly")     → 41538  ($1,800/mo → $415.38/wk)
 */
export function normaliseToPeriod(
  amount: Cents,
  fromFrequency: BudgetFrequency,
  toPeriod: BudgetFrequency,
): Cents {
  if (fromFrequency === toPeriod) return amount;
  const annual = amount * PER_YEAR[fromFrequency];
  return Math.round(annual / PER_YEAR[toPeriod]) as Cents;
}

/** True when fromFreq and toPeriod differ — used to decide whether to show the conversion label in the UI. */
export function frequencyDiffersFromPeriod(
  fromFrequency: BudgetFrequency,
  toPeriod: BudgetFrequency,
): boolean {
  return fromFrequency !== toPeriod;
}

/** Human-readable conversion hint: "$100/week → monthly" */
export function frequencyConversionLabel(
  fromFrequency: BudgetFrequency,
  toPeriod: BudgetFrequency,
): string {
  if (fromFrequency === toPeriod) return FREQUENCY_LABEL[toPeriod];
  return `${FREQUENCY_LABEL[fromFrequency]} → ${FREQUENCY_LABEL[toPeriod].toLowerCase()}`;
}
