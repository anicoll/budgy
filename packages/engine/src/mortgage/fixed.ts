import { addMonths, toDay } from "../dates";
import type { Cents } from "../money/cents";
import {
  type BalancePoint,
  type LoanInput,
  type RateChange,
  type SimulationResult,
  simulateLoan,
  validateLoan,
} from "./simulate";

/**
 * Fix, stay variable, or split?
 *
 * The loan is run twice from today with the lender-style simulation:
 *
 * - all variable: the whole balance follows the variable rate path;
 * - the plan: `fixedShare` of the balance is fixed for `fixedMonths`, then
 *   reverts to the variable path (plus a revert margin, since revert rates are
 *   often above what new customers get). The rest stays variable.
 *
 * Each part of a split loan is its own account, with its own minimum repayment
 * over the full term. Extra repayments and the offset go on the variable part,
 * because most fixed loans cap extras and don't allow an offset. If the whole
 * loan is fixed, extras go on the fixed loan and the offset is ignored.
 *
 * The comparison is interest charged, month by month:
 *
 *   ahead(t) = interest all variable, to t - interest on the plan, to t
 *
 * Principal paid cancels out (it's still your money, just in the house), so
 * interest is the real cost. Over the fixed period this is the price of
 * certainty; over the whole loan it also depends on what the revert rate does.
 */

export interface FixedVsVariableInput {
  /**
   * The loan today on the variable rate. Its rateChanges are the variable rate
   * path you want to test.
   */
  loan: LoanInput;
  fixedRate: number;
  fixedMonths: number;
  /** Share of the balance to fix, 0 to 1. 1 fixes the whole loan. */
  fixedShare: number;
  /** Added to the variable path once the fixed period ends. Default 0. */
  revertMargin?: number;
  /**
   * A one-off cost of fixing, like a rate lock fee, paid up front. Counted
   * against the plan whenever any of the loan is fixed. Default 0.
   */
  fixingFee?: Cents;
}

export interface FixedVsVariablePoint {
  date: string;
  month: number; // months from today
  variableRate: number; // the variable rate in force on this date
  /** Interest saved by the plan so far. Positive = fixing is ahead. */
  ahead: Cents;
}

export interface FixedVsVariableResult {
  variable: SimulationResult;
  /** The fixed part of the plan, or null when nothing is fixed. */
  fixed: SimulationResult | null;
  /** The variable part of the plan, or null when the whole loan is fixed. */
  floating: SimulationResult | null;
  fixedInput: LoanInput | null;
  floatingInput: LoanInput | null;
  fixedEndDate: string;
  /** The rate the fixed part reverts to when the fixed period ends. */
  revertRate: number;
  /** Repayment per period at the start. */
  variableRepayment: Cents;
  planRepayment: Cents;
  /** Interest over the fixed period. */
  variableInterestFixedPeriod: Cents;
  planInterestFixedPeriod: Cents;
  /** Positive = the plan saves interest over the fixed period, after any fixing fee. */
  aheadFixedPeriod: Cents;
  /** Positive = the plan saves interest over the whole loan, after any fixing fee. */
  aheadLifetime: Cents;
  /** The fixing fee counted, zero when nothing is fixed. */
  fixingFee: Cents;
  planTotalInterest: Cents;
  planPayoffDate: string;
  /** Combined balance of the plan on each monthly interest date. */
  planBalances: BalancePoint[];
  timeline: FixedVsVariablePoint[];
  warnings: string[];
}

/** A common yearly limit on extra repayments to a fixed loan. Lenders vary. */
export const FIXED_EXTRA_CAP_TYPICAL = 1_000_000 as Cents;

export function validateFixedVsVariable(input: FixedVsVariableInput): string[] {
  const errors = validateLoan(input.loan);
  if (!(input.fixedRate >= 0 && input.fixedRate <= 0.2))
    errors.push("fixed rate must be between 0 and 20%");
  if (
    !(
      Number.isInteger(input.fixedMonths) &&
      input.fixedMonths >= 1 &&
      input.fixedMonths <= Math.min(120, input.loan.termMonths)
    )
  )
    errors.push("fixed period must be between 1 month and 10 years, and within the term");
  if (!(input.fixedShare >= 0 && input.fixedShare <= 1))
    errors.push("fixed share must be between 0 and 100%");
  const m = input.revertMargin ?? 0;
  if (!(m >= -0.05 && m <= 0.05)) errors.push("revert margin must be between -5% and 5%");
  const fee = input.fixingFee ?? 0;
  if (!(Number.isInteger(fee) && fee >= 0 && fee <= 2_000_000))
    errors.push("fixing fee must be between $0 and $20,000");
  return errors;
}

/** The variable rate in force on `date`, following the path. */
export function rateOn(loan: Pick<LoanInput, "annualRate" | "rateChanges">, date: string): number {
  let rate = loan.annualRate;
  const steps = [...(loan.rateChanges ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  for (const s of steps) {
    if (s.date > date) break;
    rate = s.annualRate;
  }
  return rate;
}

const clampRate = (r: number) => Math.min(0.2, Math.max(0, r));

/** The fixed part's rate changes: the revert, then the path (plus margin) after it. */
function revertPath(loan: LoanInput, fixedEnd: string, margin: number): RateChange[] {
  const after = (loan.rateChanges ?? [])
    .filter((r) => r.date > fixedEnd)
    .map((r) => ({ date: r.date, annualRate: clampRate(r.annualRate + margin) }));
  return [{ date: fixedEnd, annualRate: clampRate(rateOn(loan, fixedEnd) + margin) }, ...after];
}

/** Split a balance in whole cents; the fixed part gets the rounding. */
function splitBalance(balance: Cents, share: number): [Cents, Cents] {
  const fixed = Math.round(balance * share);
  return [fixed as Cents, (balance - fixed) as Cents];
}

/** Fast lookups of a simulation's balance and interest to date on any day. */
function tracker(points: BalancePoint[]) {
  const days = points.map((p) => toDay(p.date));
  // The last point on or before `day`, or -1.
  const find = (day: number) => {
    let lo = -1;
    let hi = days.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (days[mid] <= day) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  return {
    interest: (day: number) => {
      const i = find(day);
      return i < 0 ? 0 : points[i].interestToDate;
    },
    balance: (day: number) => points[Math.max(0, find(day))]?.balance ?? 0,
  };
}

/** Add up balances from simulations that share interest dates. */
function combineBalances(parts: SimulationResult[]): BalancePoint[] {
  const tracks = parts.map((p) => tracker(p.balances));
  const dates = [...new Set(parts.flatMap((p) => p.balances.map((b) => b.date)))].sort();
  return dates.map((date) => {
    const day = toDay(date);
    return {
      date,
      balance: tracks.reduce((s, t) => s + t.balance(day), 0) as Cents,
      interestToDate: tracks.reduce((s, t) => s + t.interest(day), 0) as Cents,
    };
  });
}

export function compareFixedVsVariable(input: FixedVsVariableInput): FixedVsVariableResult {
  const errors = validateFixedVsVariable(input);
  if (errors.length) throw new RangeError(errors.join("; "));

  const { loan, fixedRate, fixedMonths, fixedShare } = input;
  const margin = input.revertMargin ?? 0;
  const start = loan.startDate;
  const fixedEndDate = addMonths(start, fixedMonths);
  const revertRate = clampRate(rateOn(loan, fixedEndDate) + margin);

  // A plain variable loan: no fixed repayment override, path as given.
  const variableInput: LoanInput = { ...loan, repayment: undefined };
  const variable = simulateLoan(variableInput);

  const [fixedBalance, floatingBalance] = splitBalance(loan.balance, fixedShare);
  const allFixed = floatingBalance === 0;

  const fixedInput: LoanInput | null =
    fixedBalance > 0
      ? {
          ...loan,
          balance: fixedBalance,
          annualRate: fixedRate,
          rateChanges: revertPath(loan, fixedEndDate, margin),
          repayment: undefined,
          offsetBalance: undefined,
          offsetMonthlyDeposit: undefined,
          extraPerPeriod: allFixed ? loan.extraPerPeriod : undefined,
          lumpSums: allFixed ? loan.lumpSums : undefined,
        }
      : null;
  const floatingInput: LoanInput | null = allFixed
    ? null
    : { ...loan, balance: floatingBalance, repayment: undefined };

  const fixed = fixedInput ? simulateLoan(fixedInput) : null;
  const floating = floatingInput ? simulateLoan(floatingInput) : null;
  const parts = [fixed, floating].filter((p): p is SimulationResult => p !== null);
  const planBalances = combineBalances(parts);

  const variableTrack = tracker(variable.balances);
  const partTracks = parts.map((p) => tracker(p.balances));
  const planInterestBy = (day: number) => partTracks.reduce((s, t) => s + t.interest(day), 0);
  const fixedEndDay = toDay(fixedEndDate);
  const variableInterestFixedPeriod = variableTrack.interest(fixedEndDay) as Cents;
  const planInterestFixedPeriod = planInterestBy(fixedEndDay) as Cents;
  const planTotalInterest = parts.reduce((s, p) => s + p.totalInterest, 0) as Cents;
  const planPayoffDate = parts.map((p) => p.payoffDate).reduce((a, b) => (b > a ? b : a));

  // A fee only applies when something is fixed.
  const fee = fixedBalance > 0 ? (input.fixingFee ?? 0) : 0;

  const lastPayoff = [variable.payoffDate, planPayoffDate].sort().at(-1) as string;
  const timeline: FixedVsVariablePoint[] = [];
  for (let m = 0; ; m++) {
    const date = addMonths(start, m);
    const day = toDay(date);
    timeline.push({
      date,
      month: m,
      variableRate: rateOn(loan, date),
      ahead: Math.round(variableTrack.interest(day) - planInterestBy(day) - fee) as Cents,
    });
    if (date >= lastPayoff) break;
  }

  const warnings: string[] = [];
  if (allFixed && (loan.offsetBalance ?? 0) > 0)
    warnings.push(
      "Most fixed loans don't have an offset, so your offset isn't counted when the whole loan is fixed.",
    );
  if (allFixed && (loan.extraPerPeriod ?? 0) > 0) {
    const perYear = { weekly: 52, fortnightly: 26, monthly: 12 }[loan.frequency];
    const extraYear = (loan.extraPerPeriod ?? 0) * perYear;
    warnings.push(
      extraYear > FIXED_EXTRA_CAP_TYPICAL
        ? `Your extra repayments add up to $${Math.round(extraYear / 100).toLocaleString("en-AU")} a year. Most fixed loans cap extras, often at $10,000 a year, and charge break costs over that. A split keeps the extra on the variable part.`
        : "Most fixed loans cap extra repayments, often at $10,000 a year. Check your lender's limit.",
    );
  }
  if (floatingInput && (loan.offsetBalance ?? 0) > floatingBalance)
    warnings.push(
      "Your offset is bigger than the variable part, so some of it earns nothing. A bigger variable part would use it all.",
    );
  if (!variable.paidOff || parts.some((p) => !p.paidOff))
    warnings.push("The loan is not repaid within 100 years at this repayment.");

  return {
    variable,
    fixed,
    floating,
    fixedInput,
    floatingInput,
    fixedEndDate,
    revertRate,
    variableRepayment: variable.repayment,
    planRepayment: parts.reduce((s, p) => s + p.repayment, 0) as Cents,
    variableInterestFixedPeriod,
    planInterestFixedPeriod,
    aheadFixedPeriod: (variableInterestFixedPeriod - planInterestFixedPeriod - fee) as Cents,
    aheadLifetime: (variable.totalInterest - planTotalInterest - fee) as Cents,
    fixingFee: fee as Cents,
    planTotalInterest,
    planPayoffDate,
    planBalances,
    timeline,
    warnings,
  };
}

/**
 * The flat variable rate at which fixing breaks even over the fixed period.
 *
 * If the variable rate averaged above this for the whole fixed period, fixing
 * would have cost less interest. Below it, staying variable wins. Returns null
 * when nothing is fixed. Solved to 0.01%.
 */
export function breakEvenVariableRate(input: FixedVsVariableInput): number | null {
  if (input.fixedShare <= 0) return null;
  const aheadAt = (rate: number) =>
    compareFixedVsVariable({
      ...input,
      loan: { ...input.loan, annualRate: rate, rateChanges: [] },
    }).aheadFixedPeriod;
  // ahead rises with the variable rate. Search in basis points.
  let lo = 0;
  let hi = 2000;
  if (aheadAt(lo / 10_000) >= 0) return 0;
  if (aheadAt(hi / 10_000) < 0) return 0.2;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (aheadAt(mid / 10_000) >= 0) hi = mid;
    else lo = mid;
  }
  return hi / 10_000;
}

/**
 * A rough break cost for leaving a fixed loan early.
 *
 * Lenders charge roughly what they lose by relending your money at today's
 * lower fixed rate for the rest of your fixed period: the rate gap on the
 * balance for the time left, discounted back to today. Real break costs use
 * the lender's own funding rates and formula, so treat this as a ballpark.
 * Zero if rates have risen since you fixed.
 */
export function estimateBreakCost(
  balance: Cents,
  fixedRate: number,
  replacementRate: number,
  monthsLeft: number,
): Cents {
  const gap = fixedRate - replacementRate;
  if (gap <= 0 || monthsLeft <= 0 || balance <= 0) return 0 as Cents;
  let cost = 0;
  const monthly = replacementRate / 12;
  for (let m = 1; m <= monthsLeft; m++) {
    cost += (balance * gap) / 12 / (1 + monthly) ** m;
  }
  return Math.round(cost) as Cents;
}

/** Simple rate paths, as steps from today's rate. */
export type RatePathPreset = "hold" | "fall-1" | "rise-1" | "rise-2";

export const RATE_PATH_PRESETS: Record<RatePathPreset, { label: string; steps: number[][] }> = {
  // [months from today, change from today's rate]
  hold: { label: "Rates hold", steps: [] },
  "fall-1": {
    label: "Fall 1% over a year",
    steps: [
      [3, -0.0025],
      [6, -0.005],
      [9, -0.0075],
      [12, -0.01],
    ],
  },
  "rise-1": {
    label: "Rise 1% over a year",
    steps: [
      [3, 0.0025],
      [6, 0.005],
      [9, 0.0075],
      [12, 0.01],
    ],
  },
  "rise-2": {
    label: "Rise 2% over two years",
    steps: [
      [3, 0.0025],
      [6, 0.005],
      [9, 0.0075],
      [12, 0.01],
      [15, 0.0125],
      [18, 0.015],
      [21, 0.0175],
      [24, 0.02],
    ],
  },
};

/** A preset as dated rate changes from `startDate`, off today's variable rate. */
export function presetPath(
  preset: RatePathPreset,
  startDate: string,
  annualRate: number,
): RateChange[] {
  return RATE_PATH_PRESETS[preset].steps.map(([months, change]) => ({
    date: addMonths(startDate, months),
    annualRate: clampRate(Math.round((annualRate + change) * 1e6) / 1e6),
  }));
}
