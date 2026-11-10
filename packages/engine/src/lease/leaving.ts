import type { Cents } from "../money/cents";
import type { NovatedLeaseInput, NovatedLeaseResult } from "./novated";

/**
 * "If you leave your job": what the rest of a novated lease costs if it turns
 * into a personal lease, with payments from after-tax pay.
 *
 * The lease usually either moves to you personally or to a new employer who
 * is willing to take it on. This works out the personal case. The packaging
 * tax benefit stops, and your employer no longer claims back GST, so the
 * packaged amounts (which have no GST) are paid with GST added on, except
 * registration. That's an estimate: a lender can set the terms differently.
 *
 * It compares, over the months left, with what the lease costs you now. That
 * is the lease's real cost in each lease year (pay lost after tax savings),
 * pro-rated for the months left. The residual is still due at the end either
 * way, so it's reported separately rather than added to both sides.
 */

export interface LeaveScenario {
  /** Months left on the lease, 1 to the full term. */
  monthsLeft: number;
  /** What a personal lease would take from after-tax pay over the months left. */
  personalTotal: Cents;
  /** What the lease costs you now over the same months (after the tax savings). */
  currentTotal: Cents;
  /** personalTotal - currentTotal: the extra cost of leaving it as a personal lease. */
  extra: Cents;
  /** After-tax cost a pay or a year on a personal lease. */
  personal: Record<"weekly" | "fortnightly" | "monthly" | "yearly", Cents>;
  /** The same on the current packaged lease, averaged over the months left. */
  current: Record<"weekly" | "fortnightly" | "monthly" | "yearly", Cents>;
  /** Still due at the end whoever holds the lease: the residual plus GST. */
  residualWithGst: Cents;
}

const toC = (n: number) => Math.round(n) as Cents;

export function validateLeave(result: NovatedLeaseResult, monthsLeft: number): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(monthsLeft) || monthsLeft < 1 || monthsLeft > result.months)
    errors.push(`months left should be 1 to ${result.months}`);
  return errors;
}

export function leaveScenario(
  input: NovatedLeaseInput,
  result: NovatedLeaseResult,
  monthsLeft: number,
): LeaveScenario {
  const errors = validateLeave(result, monthsLeft);
  if (errors.length) throw new RangeError(errors.join("; "));

  const packageCost = result.years[0].packageCost;
  const registration = input.running.registration;
  // GST comes back on everything packaged except registration.
  const personalYear = (packageCost - registration) * 1.1 + registration;

  // The current cost over the last `monthsLeft` months, lease year by lease year.
  const elapsed = result.months - monthsLeft;
  let currentTotal = 0;
  for (const y of result.years) {
    const from = (y.year - 1) * 12;
    const overlap = Math.max(0, Math.min(from + 12, result.months) - Math.max(from, elapsed));
    currentTotal += (y.cost * overlap) / 12;
  }
  const personalTotal = (personalYear * monthsLeft) / 12;

  const spread = (total: number) => ({
    weekly: toC((total * 12) / monthsLeft / 52),
    fortnightly: toC((total * 12) / monthsLeft / 26),
    monthly: toC(total / monthsLeft),
    yearly: toC((total * 12) / monthsLeft),
  });

  return {
    monthsLeft,
    personalTotal: toC(personalTotal),
    currentTotal: toC(currentTotal),
    extra: toC(personalTotal - currentTotal),
    personal: spread(personalTotal),
    current: spread(currentTotal),
    residualWithGst: result.residualWithGst,
  };
}
