import type { Transaction } from "@/features/transactions/types";
import { signedAmount } from "@/features/transactions/types";
import type { Cents } from "@/lib/money/cents";
import type { CategoryTarget } from "../types";
import { fundedBetween } from "./envelope";

/** Result of a next-due prediction for a single envelope. */
export interface ForecastResult {
  /** ISO date string for the predicted next bill. */
  nextDueOn: string;
  /** `high` = derived from ≥2 regular historical bills; `low` = fallback to openedAt + frequency. */
  confidence: "high" | "low";
  /** Projected envelope balance on `nextDueOn` if funding continues at the current cadence. */
  fundedByNextDue: Cents;
}

const MS_PER_DAY = 86_400_000;

const FREQUENCY_DAYS = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
} as const;

const LOOKBACK_DAYS = 365;
/** Spend must be at least 50% of the target amount to count as a "bill" event. */
const SIGNIFICANT_RATIO = 0.5;
/** If observed spacings vary more than this (stddev/mean), fall back. */
const MAX_SPACING_CV = 0.5;

function isoAddDays(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * MS_PER_DAY;
  return new Date(t).toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(`${fromISO}T00:00:00Z`);
  const to = Date.parse(`${toISO}T00:00:00Z`);
  return (to - from) / MS_PER_DAY;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Predict the next due date and projected balance at that date for an envelope.
 *
 * Strategy:
 *  1. Look at significant spend transactions (≥ 50% of target) in the last 12 months
 *  2. If ≥2 such transactions and their inter-arrival spacing has low variance,
 *     predict next = latest + median(spacing). Confidence: high.
 *  3. Otherwise fall back to openedAt + (cycles_elapsed + 1) × frequency. Confidence: low.
 *
 * Returns null if the target's openedAt is in the future.
 */
export function computeForecast(
  target: CategoryTarget,
  transactions: Transaction[],
  currentBalance: Cents,
  nowISO: string,
): ForecastResult | null {
  if (target.openedAt > nowISO) return null;

  const lookbackFrom = isoAddDays(nowISO, -LOOKBACK_DAYS);
  const significantThreshold = target.amount * SIGNIFICANT_RATIO;

  // Collect significant spend transactions for this category in the lookback window
  const events: { date: string; amount: number }[] = [];
  for (const t of transactions) {
    if (t.categoryId !== target.categoryId) continue;
    if (t.date < lookbackFrom || t.date > nowISO) continue;
    if (t.type === "credit") continue;
    const abs = Math.abs(signedAmount(t));
    if (abs < significantThreshold) continue;
    events.push({ date: t.date, amount: abs });
  }
  events.sort((a, b) => a.date.localeCompare(b.date));

  let nextDueOn: string;
  let confidence: ForecastResult["confidence"];

  if (events.length >= 2) {
    // Compute spacings between consecutive significant events
    const spacings: number[] = [];
    for (let i = 1; i < events.length; i++) {
      spacings.push(daysBetween(events[i - 1].date, events[i].date));
    }
    const med = median(spacings);
    const mean = spacings.reduce((s, x) => s + x, 0) / spacings.length;
    const variance = spacings.reduce((s, x) => s + (x - mean) ** 2, 0) / spacings.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : Infinity;

    if (cv <= MAX_SPACING_CV && med > 0) {
      nextDueOn = isoAddDays(events[events.length - 1].date, Math.round(med));
      confidence = "high";
    } else {
      nextDueOn = fallbackNextDue(target, nowISO);
      confidence = "low";
    }
  } else {
    nextDueOn = fallbackNextDue(target, nowISO);
    confidence = "low";
  }

  // If the prediction is in the past (e.g. bill is overdue), bump it forward by one period
  if (nextDueOn < nowISO) {
    nextDueOn = isoAddDays(nowISO, FREQUENCY_DAYS[target.frequency]);
  }

  // Project balance on nextDueOn: current + additional funding between now and then
  const additional = fundedBetween(target, nowISO, nextDueOn);
  const fundedByNextDue = (currentBalance + additional) as Cents;

  return { nextDueOn, confidence, fundedByNextDue };
}

function fallbackNextDue(target: CategoryTarget, nowISO: string): string {
  const periodDays = FREQUENCY_DAYS[target.frequency];
  const elapsed = daysBetween(target.openedAt, nowISO);
  const cyclesCompleted = Math.max(0, Math.floor(elapsed / periodDays));
  return isoAddDays(target.openedAt, (cyclesCompleted + 1) * periodDays);
}
