import type { Cents } from "@/lib/money/cents";

export type BudgetFrequency = "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly";

// Days in each period. Uses a fixed 30-day month (360-day year equivalent)
// which matches AU consumer apps (e.g. Sorted). This gives intuitive results:
//   $3,400/month → $793.33/week  (3400 × 7/30)
//   $5,040/fortnight → $2,520/week  (5040 × 7/14 = exact)
//   $1,000/fortnight → $500/week  (exact)
const DAYS: Record<BudgetFrequency, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};

export const FREQUENCY_LABEL: Record<BudgetFrequency, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export const FREQUENCY_SHORT_LABEL: Record<BudgetFrequency, string> = {
  weekly: "wk",
  fortnightly: "fn",
  monthly: "mo",
  quarterly: "qtr",
  yearly: "yr",
};

/**
 * Convert an amount from its native frequency to a target viewing period.
 * Uses a days-based formula (week=7, fortnight=14, month=30, quarter=91, year=365)
 * for intuitive results that match common AU budgeting apps.
 *
 * Examples:
 *   normaliseToPeriod(10000,  "weekly",      "monthly")      → 42857  ($100/wk → $428.57/mo)
 *   normaliseToPeriod(504000, "fortnightly", "weekly")       → 252000 ($5,040/fn → $2,520/wk — exact)
 *   normaliseToPeriod(100000, "fortnightly", "weekly")       → 50000  ($1,000/fn → $500/wk — exact)
 *   normaliseToPeriod(340000, "monthly",     "weekly")       → 79333  ($3,400/mo → $793.33/wk)
 *   normaliseToPeriod(52700,  "quarterly",   "weekly")       → 4053   ($527/qtr → $40.54/wk)
 */
export function normaliseToPeriod(
  amount: Cents,
  fromFrequency: BudgetFrequency,
  toPeriod: BudgetFrequency,
): Cents {
  if (fromFrequency === toPeriod) return amount;
  return Math.round((amount * DAYS[toPeriod]) / DAYS[fromFrequency]) as Cents;
}

/** True when fromFreq and toPeriod differ. */
export function frequencyDiffersFromPeriod(
  fromFrequency: BudgetFrequency,
  toPeriod: BudgetFrequency,
): boolean {
  return fromFrequency !== toPeriod;
}

/** Human-readable conversion hint: "Fortnightly → monthly" */
export function frequencyConversionLabel(
  fromFrequency: BudgetFrequency,
  toPeriod: BudgetFrequency,
): string {
  if (fromFrequency === toPeriod) return FREQUENCY_LABEL[toPeriod];
  return `${FREQUENCY_LABEL[fromFrequency]} → ${FREQUENCY_LABEL[toPeriod].toLowerCase()}`;
}
