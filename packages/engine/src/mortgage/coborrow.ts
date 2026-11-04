import { addYears } from "../dates";
import type { Cents } from "../money/cents";
import { compareResults } from "./scenarios";
import {
  type FortnightlyMethod,
  type Frequency,
  type LoanInput,
  type LumpSum,
  type SimulationResult,
  simulateLoan,
  validateLoan,
} from "./simulate";

/**
 * Co-borrower split: one home loan shared by two or more people.
 *
 * The bank sees one loan. This tracks what's fair between the borrowers by
 * giving each person their own ledger for their share of the balance:
 *
 * - each portion is run through the same lender-style simulation as the
 *   mortgage tool (daily interest, monthly charge, real repayment dates);
 * - each person's minimum is the standard repayment on their portion over the
 *   years left, so together the minimums cover the loan;
 * - a person's extra repayments, offset savings and lump sums only shrink their
 *   own portion, so they stop being charged interest on what they've cleared;
 * - ownership is tracked by contribution: what each person put in up front
 *   (deposit) plus the principal they've repaid since. Interest is a cost, not
 *   ownership, so it isn't counted.
 */

export interface CoBorrower {
  id: string;
  name: string;
  sharePct: number; // share of today's balance, 0-100
  deposit?: Cents; // put in up front (deposit, costs, earlier repayments)
  extraPerPeriod?: Cents;
  offsetBalance?: Cents;
  offsetMonthlyDeposit?: Cents;
  lumpSums?: LumpSum[];
  frequency?: Frequency; // own repayment cadence; defaults to the loan's
}

export interface CoBorrowInput {
  balance: Cents;
  annualRate: number;
  termMonths: number;
  startDate: string;
  frequency: Frequency;
  fortnightlyMethod?: FortnightlyMethod;
  /** Optional, for showing each person's equity in dollars. */
  propertyValue?: Cents;
  parties: CoBorrower[];
}

export interface CoBorrowerResult {
  id: string;
  name: string;
  sharePct: number;
  portion: Cents;
  frequency: Frequency;
  result: SimulationResult;
  /** The same portion on minimum repayments only, no offset or extras. */
  baseline: SimulationResult;
  interestSaved: Cents;
  daysSaved: number;
  /**
   * This person's interest if the loan's total interest were simply divided by
   * share. Above `result.totalInterest` means a plain split would overcharge them.
   */
  proRataInterest: Cents;
}

export interface OwnershipPoint {
  year: number; // 0 = today
  date: string;
  contributed: Cents[]; // deposit + principal repaid so far, per party
  shares: number[]; // fraction of all contributions, per party (sums to 1)
  balance: Cents; // whole loan balance at this point
  equity?: Cents[]; // shares × (property value − balance), when a value is given
}

export interface CoBorrowResult {
  shareTotal: number;
  parties: CoBorrowerResult[];
  /** All minimums as a monthly figure (weekly × 52 / 12, fortnightly × 26 / 12). */
  monthlyMinimum: Cents;
  /** All repayments, extras included, as a monthly figure. */
  monthlyRepayment: Cents;
  debtFreeDate: string; // when the last portion is cleared
  totalInterest: Cents;
  totalPaid: Cents;
  ownership: OwnershipPoint[];
  warnings: string[];
}

export const MAX_PARTIES = 4;
const PER_YEAR = { weekly: 52, fortnightly: 26, monthly: 12 } as const;

/**
 * Split a balance into whole-cent portions by percentage, so they add up to
 * the balance exactly (largest remainder goes first).
 */
export function splitPortions(balance: number, sharePcts: number[]): Cents[] {
  const total = sharePcts.reduce((s, p) => s + p, 0);
  if (total <= 0) return sharePcts.map(() => 0 as Cents);
  const raw = sharePcts.map((p) => (balance * p) / total);
  const out = raw.map(Math.floor);
  let left = balance - out.reduce((s, x) => s + x, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out as Cents[];
}

export function validateCoBorrow(input: CoBorrowInput): string[] {
  const { parties } = input;
  const errors = validateLoan({
    balance: input.balance,
    annualRate: input.annualRate,
    termMonths: input.termMonths,
    startDate: input.startDate,
    frequency: input.frequency,
  });
  if (parties.length < 2) errors.push("add at least two borrowers");
  if (parties.length > MAX_PARTIES) errors.push(`at most ${MAX_PARTIES} borrowers`);
  if (new Set(parties.map((p) => p.id)).size !== parties.length)
    errors.push("borrower ids must be unique");
  for (const p of parties) {
    const who = p.name || "a borrower";
    if (!(p.sharePct > 0 && p.sharePct <= 100)) errors.push(`${who}: share must be more than 0%`);
    if (p.deposit !== undefined && !(Number.isInteger(p.deposit) && p.deposit >= 0))
      errors.push(`${who}: deposit can't be negative`);
    const own = validateLoan({
      balance: 100 as Cents,
      annualRate: 0,
      termMonths: 12,
      startDate: input.startDate,
      frequency: p.frequency ?? input.frequency,
      extraPerPeriod: p.extraPerPeriod,
      offsetBalance: p.offsetBalance,
      offsetMonthlyDeposit: p.offsetMonthlyDeposit,
      lumpSums: p.lumpSums,
    });
    for (const e of own) errors.push(`${who}: ${e}`);
  }
  const total = parties.reduce((s, p) => s + p.sharePct, 0);
  if (Math.abs(total - 100) > 0.005) errors.push(`shares add up to ${round2(total)}%, not 100%`);
  if (input.propertyValue !== undefined && !(input.propertyValue >= 0))
    errors.push("property value can't be negative");
  return errors;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function splitLoan(input: CoBorrowInput): CoBorrowResult {
  const errors = validateCoBorrow(input);
  if (errors.length) throw new RangeError(errors.join("; "));
  const { parties } = input;
  const portions = splitPortions(
    input.balance,
    parties.map((p) => p.sharePct),
  );

  const runs = parties.map((p, i) => {
    const frequency = p.frequency ?? input.frequency;
    const loan: LoanInput = {
      balance: portions[i],
      annualRate: input.annualRate,
      termMonths: input.termMonths,
      startDate: input.startDate,
      frequency,
      fortnightlyMethod: input.fortnightlyMethod,
    };
    const result = simulateLoan({
      ...loan,
      extraPerPeriod: p.extraPerPeriod,
      offsetBalance: p.offsetBalance,
      offsetMonthlyDeposit: p.offsetMonthlyDeposit,
      lumpSums: p.lumpSums,
    });
    // Baseline: minimums at the loan's own frequency, so paying fortnightly counts as a saving.
    const baseline = simulateLoan({ ...loan, frequency: input.frequency });
    return { p, i, frequency, result, baseline };
  });

  const totalInterest = runs.reduce((s, r) => s + r.result.totalInterest, 0);
  const totalPaid = runs.reduce((s, r) => s + r.result.totalPaid, 0);
  const toMonthly = (perPeriod: number, f: Frequency) => (perPeriod * PER_YEAR[f]) / 12;
  const monthlyMinimum = Math.round(
    runs.reduce((s, r) => s + toMonthly(r.result.minimumRepayment, r.frequency), 0),
  );
  const monthlyRepayment = Math.round(
    runs.reduce((s, r) => s + toMonthly(r.result.repayment, r.frequency), 0),
  );
  const debtFreeDate =
    runs
      .map((r) => r.result.payoffDate)
      .sort()
      .at(-1) ?? input.startDate;

  // Ownership by contribution, at today and the end of each year.
  const years = Math.max(...runs.map((r) => r.result.yearly.length));
  const deposits = parties.map((p) => (p.deposit ?? 0) as number);
  const ownership: OwnershipPoint[] = [];
  for (let y = 0; y <= years; y++) {
    const contributed = runs.map(
      (r, i) => deposits[i] + r.result.yearly.slice(0, y).reduce((s, row) => s + row.principal, 0),
    );
    const sum = contributed.reduce((s, c) => s + c, 0);
    const shares =
      sum > 0 ? contributed.map((c) => c / sum) : parties.map(() => 1 / parties.length);
    const balance = runs.reduce((s, r) => {
      if (y === 0) return s + r.result.balances[0].balance;
      const row = r.result.yearly[y - 1];
      return s + (row ? row.closingBalance : 0);
    }, 0);
    const anniversary = addYears(input.startDate, y);
    const date = [anniversary, debtFreeDate].sort()[0];
    const point: OwnershipPoint = {
      year: y,
      date,
      contributed: contributed as Cents[],
      shares,
      balance: balance as Cents,
    };
    if (input.propertyValue !== undefined) {
      const net = input.propertyValue - balance;
      const parts = splitPortions(Math.abs(net), shares);
      point.equity = (net < 0 ? parts.map((e) => -e) : parts) as Cents[];
    }
    ownership.push(point);
  }

  const warnings = [...new Set(runs.flatMap((r) => r.result.warnings))];

  return {
    shareTotal: parties.reduce((s, p) => s + p.sharePct, 0),
    parties: runs.map(({ p, i, frequency, result, baseline }) => {
      const cmp = compareResults(baseline, result);
      return {
        id: p.id,
        name: p.name,
        sharePct: p.sharePct,
        portion: portions[i],
        frequency,
        result,
        baseline,
        interestSaved: cmp.interestSaved,
        daysSaved: cmp.daysSaved,
        proRataInterest: Math.round((totalInterest * p.sharePct) / 100) as Cents,
      };
    }),
    monthlyMinimum: monthlyMinimum as Cents,
    monthlyRepayment: monthlyRepayment as Cents,
    debtFreeDate,
    totalInterest: totalInterest as Cents,
    totalPaid: totalPaid as Cents,
    ownership,
    warnings,
  };
}
