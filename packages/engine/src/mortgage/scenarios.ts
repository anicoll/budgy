import { toDay } from "../dates";
import type { Cents } from "../money/cents";
import { type BalancePoint, type LoanInput, type SimulationResult, simulateLoan } from "./simulate";

/** Interest charged up to and including `day`, from a simulation's balance points. */
export function interestBy(points: BalancePoint[], day: number): number {
  let last = 0;
  for (const p of points) {
    if (toDay(p.date) > day) break;
    last = p.interestToDate;
  }
  return last;
}

export interface ScenarioComparison {
  interestSaved: Cents; // base interest minus scenario interest (negative = costs more)
  daysSaved: number; // base payoff minus scenario payoff, in days
  monthsSaved: number; // daysSaved in whole months (rounded down)
}

export function compareResults(
  base: SimulationResult,
  other: SimulationResult,
): ScenarioComparison {
  const daysSaved = toDay(base.payoffDate) - toDay(other.payoffDate);
  return {
    interestSaved: (base.totalInterest - other.totalInterest) as Cents,
    daysSaved,
    monthsSaved: Math.trunc(daysSaved / 30.4375),
  };
}

/** A scenario is the base loan with some fields changed. */
export type ScenarioChanges = Partial<Omit<LoanInput, "balance" | "termMonths" | "startDate">>;

export interface ScenarioRun {
  input: LoanInput;
  result: SimulationResult;
  vsBase: ScenarioComparison;
}

export function runScenarios(base: LoanInput, scenarios: ScenarioChanges[]) {
  const baseResult = simulateLoan(base);
  const runs: ScenarioRun[] = scenarios.map((changes) => {
    const input = { ...base, ...changes };
    const result = simulateLoan(input);
    return { input, result, vsBase: compareResults(baseResult, result) };
  });
  return { base: baseResult, scenarios: runs };
}

/**
 * The smallest extra repayment per period (whole dollars) that pays the loan off
 * on or before `targetDate`. Returns 0 if the loan already finishes in time, and
 * null if even paying it all off on the first repayment can't meet the date.
 */
export function solveExtraRepayment(input: LoanInput, targetDate: string): Cents | null {
  const finishesBy = (extra: number) =>
    simulateLoan({ ...input, extraPerPeriod: (extra * 100) as Cents }).payoffDate <= targetDate;
  if (finishesBy(0)) return 0 as Cents;
  let hi = Math.ceil(input.balance / 100);
  if (!finishesBy(hi)) return null;
  let lo = 0;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (finishesBy(mid)) hi = mid;
    else lo = mid;
  }
  return (hi * 100) as Cents;
}
