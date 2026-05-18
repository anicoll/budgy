import type { Transaction } from "@/features/transactions/types";
import { signedAmount } from "@/features/transactions/types";
import type { Cents } from "@/lib/money/cents";
import type { BudgetPeriod, CategoryTarget } from "../types";
import { fundedBetween } from "./envelope";
import { currentPeriodRange, shiftBudgetPeriod } from "./period";

export interface BalanceHistoryPoint {
  /** ISO date — start of the period this point covers. */
  periodStart: string;
  /** ISO date — end of the period (or nowISO for the current period). */
  periodEnd: string;
  /** Envelope balance (funded − spent) at the end of this period. */
  balance: Cents;
}

/**
 * Compute envelope balance over the last N periods for sparkline rendering.
 *
 * For each period (oldest first), returns the balance at the period's end, defined as
 * cumulative funding since openedAt minus cumulative significant spend since openedAt.
 *
 * The current period's balance is computed at `nowISO` rather than the future period-end.
 * Periods entirely before `openedAt` produce balance = 0.
 */
export function computeBalanceHistory(
  target: CategoryTarget,
  transactions: Transaction[],
  nowISO: string,
  periodCount: number,
  viewPeriod: BudgetPeriod,
): BalanceHistoryPoint[] {
  const now = new Date(`${nowISO}T00:00:00Z`);
  const baseRange = currentPeriodRange(viewPeriod, target.openedAt, now);

  // Pre-filter transactions for this category — avoids per-period rescans
  const catTxns = transactions.filter(
    (t) => t.categoryId === target.categoryId && t.type !== "credit",
  );

  const points: BalanceHistoryPoint[] = [];
  for (let i = 0; i < periodCount; i++) {
    const offset = -(periodCount - 1 - i);
    const range =
      offset === 0 ? baseRange : shiftBudgetPeriod(viewPeriod, target.openedAt, baseRange, offset);

    if (range.to < target.openedAt) {
      points.push({
        periodStart: range.from,
        periodEnd: range.to,
        balance: 0 as Cents,
      });
      continue;
    }

    // Don't project into the future for the current period
    const evalDate = range.to < nowISO ? range.to : nowISO;
    const funded = fundedBetween(target, target.openedAt, evalDate);

    let spent = 0;
    for (const t of catTxns) {
      if (t.date < target.openedAt || t.date > evalDate) continue;
      spent += Math.abs(signedAmount(t));
    }

    points.push({
      periodStart: range.from,
      periodEnd: range.to,
      balance: (funded - spent) as Cents,
    });
  }

  return points;
}
