import type { Cents } from "../money/cents";
import { PERIODS_PER_YEAR } from "./amortise";
import type { RepaymentFrequency } from "./types";

/**
 * Inverse PMT — derives the loan balance (present value) from a known periodic
 * repayment, annual interest rate, and remaining term.
 *
 * PV = PMT × (1 − (1 + r)^−n) / r
 *
 * Example: $3,200/mo, 6% p.a., 27 years → balance ≈ $512,800
 */
export function repaymentToBalance(
  repayment: Cents,
  annualRate: number,
  termYears: number,
  freq: RepaymentFrequency = "monthly",
): Cents {
  const n = termYears * PERIODS_PER_YEAR[freq];
  const r = annualRate / PERIODS_PER_YEAR[freq];
  if (r === 0 || n === 0) return Math.round(repayment * n) as Cents;
  return Math.round((repayment * (1 - (1 + r) ** -n)) / r) as Cents;
}

/**
 * The loan a repayment supports: the most you could borrow if you repay
 * `repayment` every period at `annualRate` over `termYears`. Returns 0 for a
 * repayment, term or rate that can't make a loan.
 */
export function loanForRepayment(
  repayment: Cents,
  annualRate: number,
  termYears: number,
  freq: RepaymentFrequency = "monthly",
): Cents {
  if (!(repayment > 0) || !(termYears > 0) || !(annualRate >= 0)) return 0 as Cents;
  return repaymentToBalance(repayment, annualRate, termYears, freq);
}
