import type { Cents } from "../money/cents";
import type { NovatedLeaseResult } from "./novated";

/** Two novated leases side by side, such as an electric car and a petrol one. */
export interface LeaseComparison {
  /** Index (0 or 1) of the car that costs less take-home pay, or null when they're within a dollar a pay. */
  cheaper: 0 | 1 | null;
  /** How much less the cheaper car costs in take-home pay each pay (positive). */
  perPaySaving: Cents;
  /** How much less the cheaper car costs over the lease, residual included (positive). */
  totalSaving: Cents;
  /** The cheaper car's price less the other's: positive when the cheaper one costs more to buy. */
  priceGap: Cents;
}

/**
 * Compare two lease results made with the same pay, term and rate.
 * `pays` is how many pays a year the figure is shown in (52, 26 or 12).
 */
export function compareLeases(
  a: NovatedLeaseResult,
  b: NovatedLeaseResult,
  pays: number,
  prices: [Cents, Cents],
): LeaseComparison {
  const diff = a.years[0].cost - b.years[0].cost;
  const perPay = Math.abs(diff) / pays;
  const cheaper = perPay < 100 ? null : diff < 0 ? 0 : 1;
  return {
    cheaper,
    perPaySaving: Math.round(perPay) as Cents,
    totalSaving: Math.abs(a.lease.total - b.lease.total) as Cents,
    priceGap: (cheaper === null ? 0 : prices[cheaper] - prices[cheaper === 0 ? 1 : 0]) as Cents,
  };
}
