import { addMonths, monthsBetween, toDay, toIso } from "../dates";
import type { Cents } from "../money/cents";
import { interestBy } from "./scenarios";
import {
  type LoanInput,
  minimumRepayment,
  type RateChange,
  type SimulationResult,
  simulateLoan,
  validateLoan,
} from "./simulate";

/**
 * Is switching home loans worth it after fees and cashback?
 *
 * Both loans run from the switch date with the lender-style simulation, then
 * we track how far ahead (or behind) switching leaves you each month:
 *
 *   benefit(t) = interest saved to t + ongoing fees saved to t
 *                - switching costs + cashback
 *
 * That is the change in your net worth, not the change in your repayments.
 * A lower repayment that only stretches the loan out is not counted as a
 * saving, because the money you didn't repay is still owed. (It falls out of
 * cash paid + balance owed: the principal parts cancel and only interest and
 * fees are left.)
 *
 * The break-even date is the first monthly interest date on which the benefit
 * reaches zero.
 */

export type RefinanceRepayment =
  /** Take the new loan's lower minimum repayment. */
  | "minimum"
  /** Keep paying what you pay now (or the new minimum, if that is higher). */
  | "keep";

export interface ProposedLoan {
  annualRate: number;
  /** Term of the new loan. Defaults to the months left on the current loan. */
  termMonths?: number;
  /** For a honeymoon rate: when it reverts, and to what. */
  rateChanges?: RateChange[];
}

export interface RefinanceInput {
  /** The loan as it stands on the switch date. Its startDate is the switch date. */
  current: LoanInput;
  proposed: ProposedLoan;
  repayment: RefinanceRepayment;
  /** Discharge, break costs, application, valuation, settlement, legal: everything to switch. */
  switchingCosts: Cents;
  /** Paid to you in cash by the new lender. */
  cashback: Cents;
  /** Add the switching costs to the new loan instead of paying them up front. */
  addCostsToLoan?: boolean;
  /** Package or account fees, per year. */
  currentAnnualFee?: Cents;
  proposedAnnualFee?: Cents;
}

export interface RefinancePoint {
  date: string;
  month: number; // months since the switch
  /** Positive when switching has left you ahead by this date. */
  benefit: Cents;
}

export interface RefinanceResult {
  current: SimulationResult;
  proposed: SimulationResult;
  proposedInput: LoanInput;
  /** Switching costs less cashback. Negative when the cashback covers the costs. */
  netUpfrontCost: Cents;
  /** Proposed repayment less current repayment, per period, at the start. */
  repaymentChange: Cents;
  /** First date the benefit reaches zero, or null if it never does. */
  breakEvenDate: string | null;
  breakEvenMonths: number | null;
  /** Benefit on each monthly interest date until both loans are repaid. */
  timeline: RefinancePoint[];
  /** Benefit once both loans are repaid. */
  lifetimeBenefit: Cents;
  interestSaved: Cents; // over the life of both loans
  feesSaved: Cents; // ongoing fees, over the life of both loans
  warnings: string[];
}

export function validateRefinance(input: RefinanceInput): string[] {
  const errors = validateLoan(input.current);
  const isCents = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0;
  const p = input.proposed;
  if (!(p.annualRate >= 0 && p.annualRate <= 0.2))
    errors.push("new rate must be between 0 and 20%");
  if (
    p.termMonths !== undefined &&
    !(Number.isInteger(p.termMonths) && p.termMonths >= 1 && p.termMonths <= 480)
  )
    errors.push("new term must be between 1 month and 40 years");
  for (const k of [
    "switchingCosts",
    "cashback",
    "currentAnnualFee",
    "proposedAnnualFee",
  ] as const) {
    if (input[k] !== undefined && !isCents(input[k]))
      errors.push(`${k} must be whole cents, zero or more`);
  }
  if (input.repayment !== "minimum" && input.repayment !== "keep")
    errors.push("repayment must be minimum or keep");
  return errors;
}

/** The new loan as a LoanInput, starting on the same day as the current one. */
export function proposedLoanInput(input: RefinanceInput): LoanInput {
  const { current, proposed } = input;
  const balance = (current.balance + (input.addCostsToLoan ? input.switchingCosts : 0)) as Cents;
  const termMonths = proposed.termMonths ?? current.termMonths;
  const loan: LoanInput = {
    ...current,
    balance,
    annualRate: proposed.annualRate,
    termMonths,
    rateChanges: proposed.rateChanges,
    repayment: undefined,
  };
  if (input.repayment === "keep") {
    const now =
      current.repayment ??
      minimumRepayment(
        current.balance,
        current.annualRate,
        current.termMonths,
        current.frequency,
        current.fortnightlyMethod,
      );
    const min = minimumRepayment(
      balance,
      proposed.annualRate,
      termMonths,
      current.frequency,
      current.fortnightlyMethod,
    );
    loan.repayment = Math.max(now, min) as Cents;
  }
  return loan;
}

/** Ongoing fees charged by `month`, a twelfth a month while the loan is open. */
function feesBy(annualFee: number, month: number, payoffDate: string, start: string): number {
  if (!annualFee) return 0;
  const open = Math.min(month, monthsUntilRepaid(start, payoffDate));
  return Math.round((annualFee * open) / 12);
}

/** Months of fees a loan carries: part months count as whole ones. */
function monthsUntilRepaid(start: string, payoffDate: string): number {
  const whole = monthsBetween(start, payoffDate);
  return addMonths(start, whole) < payoffDate ? whole + 1 : whole;
}

export function compareRefinance(input: RefinanceInput): RefinanceResult {
  const errors = validateRefinance(input);
  if (errors.length) throw new RangeError(errors.join("; "));

  const start = input.current.startDate;
  const proposedInput = proposedLoanInput(input);
  const current = simulateLoan(input.current);
  const proposed = simulateLoan(proposedInput);

  const currentFee = input.currentAnnualFee ?? 0;
  const proposedFee = input.proposedAnnualFee ?? 0;
  const netUpfrontCost = (input.switchingCosts - input.cashback) as Cents;
  // Costs added to the loan are paid through it: they show up as a bigger
  // balance (and the interest on it), so they aren't taken off up front.
  const upfrontCash = input.addCostsToLoan ? -input.cashback : netUpfrontCost;
  const extraBalance = input.addCostsToLoan ? input.switchingCosts : 0;

  const benefitAt = (month: number, day: number) =>
    interestBy(current.balances, day) -
    interestBy(proposed.balances, day) +
    feesBy(currentFee, month, current.payoffDate, start) -
    feesBy(proposedFee, month, proposed.payoffDate, start) -
    upfrontCash -
    extraBalance;

  const lastPayoff = toIso(Math.max(toDay(current.payoffDate), toDay(proposed.payoffDate)));
  const months = monthsUntilRepaid(start, lastPayoff);
  const timeline: RefinancePoint[] = [];
  for (let m = 0; m <= months; m++) {
    const date = addMonths(start, m);
    timeline.push({ date, month: m, benefit: Math.round(benefitAt(m, toDay(date))) as Cents });
  }

  const hit = timeline.find((p) => p.benefit >= 0);
  const interestSaved = (current.totalInterest - proposed.totalInterest) as Cents;
  const feesSaved = (feesBy(currentFee, months, current.payoffDate, start) -
    feesBy(proposedFee, months, proposed.payoffDate, start)) as Cents;
  const lifetimeBenefit = (interestSaved + feesSaved - upfrontCash - extraBalance) as Cents;

  const warnings: string[] = [];
  if (!current.paidOff || !proposed.paidOff)
    warnings.push("One of the loans is not repaid within 100 years at its repayment.");
  if (hit && lifetimeBenefit < 0)
    warnings.push(
      "Switching puts you ahead for a while, but the longer term costs more over the life of the loan.",
    );

  return {
    current,
    proposed,
    proposedInput,
    netUpfrontCost,
    repaymentChange: (proposed.repayment - current.repayment) as Cents,
    breakEvenDate: hit?.date ?? null,
    breakEvenMonths: hit?.month ?? null,
    timeline,
    lifetimeBenefit,
    interestSaved,
    feesSaved,
    warnings,
  };
}

/** How far ahead switching has left you after a number of months, from the timeline. */
export function benefitAfterMonths(r: RefinanceResult, months: number): Cents {
  const i = Math.max(0, Math.min(Math.floor(months), r.timeline.length - 1));
  return r.timeline[i].benefit;
}

export interface OfferComparison {
  years: number;
  /** Benefit after `years`, as in the timeline (switching costs and cashback included). */
  benefitA: Cents;
  benefitB: Cents;
  winner: "a" | "b" | "tie";
  /** How much better the winner is after `years`. Zero for a tie. */
  difference: Cents;
}

/**
 * Compare two offers for the same loan by how far ahead each leaves you after
 * `years`. Offers within `tieWithin` (default $1) of each other are a tie.
 */
export function compareOffers(
  a: RefinanceResult,
  b: RefinanceResult,
  years = 5,
  tieWithin: Cents = 100 as Cents,
): OfferComparison {
  const benefitA = benefitAfterMonths(a, years * 12);
  const benefitB = benefitAfterMonths(b, years * 12);
  const gap = benefitA - benefitB;
  const tie = Math.abs(gap) <= tieWithin;
  return {
    years,
    benefitA,
    benefitB,
    winner: tie ? "tie" : gap > 0 ? "a" : "b",
    difference: (tie ? 0 : Math.abs(gap)) as Cents,
  };
}
