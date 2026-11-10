import type { Cents } from "../money/cents";
import { type FortnightlyMethod, type Frequency, minimumRepayment } from "./simulate";

/**
 * Buy-out: one co-owner keeps the home and pays the other their share of the
 * equity, by taking a bigger loan in their own name.
 *
 * A rough guide only. It ignores stamp duty on the transfer, legal and lender
 * fees, and any break costs.
 */
export interface BuyOutInput {
  /** What the home is worth now. */
  value: Cents;
  /** Loan owing now, for the whole home. */
  loanOwing: Cents;
  /** The leaving person's share of the equity, 0 to 100. */
  leaverSharePct: number;
  /** Interest rate a year, such as 0.06. */
  annualRate: number;
  /** Months left on the loan. */
  termMonths: number;
  frequency?: Frequency;
  fortnightlyMethod?: FortnightlyMethod;
}

export interface BuyOutResult {
  /** Value less loan, never below zero. */
  equity: Cents;
  /** What the keeper pays the leaving person. */
  payout: Cents;
  /** The loan the keeper takes over: what is owing now. */
  loanTakenOver: Cents;
  /** Loan owing plus the payout, all in the keeper's name. */
  newLoan: Cents;
  /** Repayment on the new loan each period, over the remaining term. */
  repayment: Cents;
  frequency: Frequency;
  /** The home is worth less than the loan, so there's no equity to share. */
  underwater: boolean;
}

export function validateBuyOut(input: BuyOutInput): string[] {
  const errors: string[] = [];
  const ok = (v: number) => Number.isFinite(v) && v >= 0;
  if (!ok(input.value) || input.value <= 0) errors.push("Enter what the home is worth.");
  if (!ok(input.loanOwing)) errors.push("Enter the loan owing, or $0 if there's none.");
  if (
    !Number.isFinite(input.leaverSharePct) ||
    input.leaverSharePct < 0 ||
    input.leaverSharePct > 100
  )
    errors.push("The equity share should be between 0% and 100%.");
  if (!Number.isFinite(input.annualRate) || input.annualRate < 0 || input.annualRate > 0.3)
    errors.push("The interest rate should be 0% to 30%.");
  if (!Number.isInteger(input.termMonths) || input.termMonths < 1)
    errors.push("Enter the years left on the loan.");
  return errors;
}

/** What changes hands in a buy-out, and the new loan's repayment. */
export function calculateBuyOut(input: BuyOutInput): BuyOutResult {
  const errors = validateBuyOut(input);
  if (errors.length) throw new RangeError(errors.join(" "));
  const frequency = input.frequency ?? "monthly";
  const equity = Math.max(0, input.value - input.loanOwing) as Cents;
  const payout = Math.round((equity * input.leaverSharePct) / 100) as Cents;
  const newLoan = (input.loanOwing + payout) as Cents;
  const repayment = minimumRepayment(
    newLoan,
    input.annualRate,
    input.termMonths,
    frequency,
    input.fortnightlyMethod,
  );
  return {
    equity,
    payout,
    loanTakenOver: input.loanOwing,
    newLoan,
    repayment,
    frequency,
    underwater: input.value < input.loanOwing,
  };
}
