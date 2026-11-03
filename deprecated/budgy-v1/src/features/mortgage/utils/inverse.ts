import type { Cents } from "@/lib/money/cents";
import type { RepaymentFrequency } from "../types";
import { PERIODS_PER_YEAR } from "./amortise";

/**
 * Inverse PMT — derives the loan balance (present value) from a known periodic
 * repayment, annual interest rate, and remaining term.
 *
 * PV = PMT × (1 − (1 + r)^−n) / r
 *
 * Example: $3,200/mo, 6% p.a., 27 years → balance ≈ $526,500
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
