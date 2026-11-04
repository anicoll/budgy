import type { Cents } from "../money/cents";
import {
  averageRatesFor,
  type LoanPurpose,
  RBA_HOUSING_RATES,
  type RbaHousingRates,
  type RepaymentType,
} from "./rbaRates";
import { simulateLoan } from "./simulate";

/**
 * Am I paying too much? Compares a home loan rate with the RBA's average
 * rates for similar loans and puts a dollar figure on the gap.
 *
 * For principal-and-interest loans both rates run through the lender-style
 * simulation on the same balance and remaining term, so the repayment,
 * first-year interest and lifetime interest gaps match what the mortgage
 * tools show. Interest-only loans only pay interest, so the gap is the
 * balance times the rate difference, and there is no lifetime figure.
 */

export interface RateCheckInput {
  balance: Cents;
  annualRate: number;
  /** Months left on the loan (principal and interest). */
  termMonths: number;
  purpose: LoanPurpose;
  repayment: RepaymentType;
  /** Used to start the simulation; any date works. Defaults to 2026-01-01. */
  startDate?: string;
}

export type Benchmark = "new" | "outstanding";

export interface BenchmarkGap {
  benchmark: Benchmark;
  averageRate: number;
  /** Your rate less the average. Positive means you pay more. */
  gap: number;
  /** Monthly repayment at your rate less at the average. */
  monthlyRepaymentGap: Cents;
  /** Interest over the next 12 months at your rate less at the average. */
  firstYearInterestGap: Cents;
  /** Interest over the rest of the loan; null for interest-only loans. */
  lifetimeInterestGap: Cents | null;
}

/** Within this of the average counts as "about average". */
export const ABOUT_AVERAGE = 0.001;

export type RateVerdict = "above" | "about" | "below";

export interface RateCheckResult {
  /** The month and source of the averages used. */
  month: string;
  source: string;
  url: string;
  /** Judged against new loans: the rate a lender would offer you today. */
  verdict: RateVerdict;
  newLoans: BenchmarkGap;
  existingLoans: BenchmarkGap;
}

export function validateRateCheck(input: RateCheckInput): string[] {
  const errors: string[] = [];
  if (!(Number.isInteger(input.balance) && input.balance > 0))
    errors.push("balance must be whole cents, more than zero");
  if (!(input.annualRate > 0 && input.annualRate <= 0.2))
    errors.push("rate must be between 0 and 20%");
  if (!(Number.isInteger(input.termMonths) && input.termMonths >= 1 && input.termMonths <= 480))
    errors.push("term must be between 1 month and 40 years");
  if (input.purpose !== "owner-occupier" && input.purpose !== "investor")
    errors.push("purpose must be owner-occupier or investor");
  if (input.repayment !== "principal-and-interest" && input.repayment !== "interest-only")
    errors.push("repayment must be principal-and-interest or interest-only");
  return errors;
}

export function checkRate(
  input: RateCheckInput,
  data: RbaHousingRates = RBA_HOUSING_RATES,
): RateCheckResult {
  const errors = validateRateCheck(input);
  if (errors.length) throw new RangeError(errors.join("; "));

  const averages = averageRatesFor(input.purpose, input.repayment, data);
  const yours = input.repayment === "principal-and-interest" ? principalAndInterest(input) : null;

  const gapFor = (benchmark: Benchmark): BenchmarkGap => {
    const averageRate = averages[benchmark];
    const gap = round6(input.annualRate - averageRate);
    if (input.repayment === "interest-only") {
      const yearly = Math.round(input.balance * gap);
      return {
        benchmark,
        averageRate,
        gap,
        monthlyRepaymentGap: Math.round(yearly / 12) as Cents,
        firstYearInterestGap: yearly as Cents,
        lifetimeInterestGap: null,
      };
    }
    const at = principalAndInterest({ ...input, annualRate: averageRate });
    const y = yours ?? principalAndInterest(input);
    return {
      benchmark,
      averageRate,
      gap,
      monthlyRepaymentGap: (y.repayment - at.repayment) as Cents,
      firstYearInterestGap: (y.firstYearInterest - at.firstYearInterest) as Cents,
      lifetimeInterestGap: (y.totalInterest - at.totalInterest) as Cents,
    };
  };

  const newLoans = gapFor("new");
  const verdict: RateVerdict =
    newLoans.gap > ABOUT_AVERAGE ? "above" : newLoans.gap < -ABOUT_AVERAGE ? "below" : "about";

  return {
    month: data.month,
    source: data.source,
    url: data.url,
    verdict,
    newLoans,
    existingLoans: gapFor("outstanding"),
  };
}

interface Simulated {
  repayment: number;
  firstYearInterest: number;
  totalInterest: number;
}

function principalAndInterest(input: RateCheckInput): Simulated {
  const r = simulateLoan({
    balance: input.balance,
    annualRate: input.annualRate,
    termMonths: input.termMonths,
    startDate: input.startDate ?? "2026-01-01",
    frequency: "monthly",
  });
  return {
    repayment: r.minimumRepayment,
    firstYearInterest: r.yearly[0]?.interest ?? 0,
    totalInterest: r.totalInterest,
  };
}

/** Rates are decimals; keep the subtraction from showing float noise. */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
