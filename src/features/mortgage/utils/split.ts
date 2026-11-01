import type { Cents } from "@/lib/money/cents";
import type { RepaymentFrequency, SplitLumpSum, SplitParty } from "../types";
import { calcMinRepayment, PERIODS_PER_YEAR, periodToDate } from "./amortise";

/**
 * Split-loan modelling.
 *
 * A jointly held loan is divided into portions, one per party. Each portion is
 * tracked as its own ledger:
 *
 * - interest is charged only on that party's outstanding portion (less their own offset),
 * - each party's minimum repayment is the PMT of their portion over the loan term,
 *   so the minimums add up to the lender's minimum for the whole loan,
 * - extra repayments and lump sums only reduce the portion of the party who made them.
 *
 * A party who pays faster clears their portion sooner and stops being charged
 * interest on it, while the other parties carry on at their own pace.
 */

/** Tolerance for share percentages adding up to 100. */
const SHARE_EPSILON = 0.005;

export interface SplitInput {
  currentBalance: Cents;
  interestRate: number;
  termYears: number;
  repaymentFrequency: RepaymentFrequency;
  startDate: string; // YYYY-MM
  parties: SplitParty[];
}

export interface SplitPartyPeriod {
  opening: Cents;
  interest: Cents;
  payment: Cents; // total paid this period (interest + principal)
  extra: Cents; // portion of payment above the party's minimum
  closing: Cents;
}

export interface SplitPeriodRow {
  period: number;
  date: string; // YYYY-MM
  parties: SplitPartyPeriod[]; // same order as input parties
  totalPayment: Cents;
  totalInterest: Cents;
  totalClosing: Cents;
}

export interface SplitPartyResult {
  id: string;
  name: string;
  sharePct: number;
  portion: Cents; // share of the current balance
  interestRate: number; // effective annual rate for this portion
  minimumRepayment: Cents; // per period, before extras
  totalInterest: Cents;
  totalPaid: Cents;
  payoffPeriods: number;
  payoffDate: string;
  /** Interest this party would pay making only minimum repayments with no offset. */
  baselineInterest: Cents;
  interestSaved: Cents;
  periodsSaved: number;
  /**
   * Interest this party would be charged if the loan's total interest were simply
   * divided by ownership share. Compare with totalInterest to see who would be
   * over- or under-charged by a naive split.
   */
  proRataInterest: Cents;
}

export interface SplitResult {
  valid: boolean;
  shareTotal: number;
  parties: SplitPartyResult[];
  rows: SplitPeriodRow[];
  combinedMinimum: Cents;
  totalInterest: Cents;
  totalPaid: Cents;
  payoffPeriods: number;
  payoffDate: string;
}

export function shareTotal(parties: Pick<SplitParty, "sharePct">[]): number {
  return parties.reduce((sum, p) => sum + (Number.isFinite(p.sharePct) ? p.sharePct : 0), 0);
}

export function sharesAreValid(parties: Pick<SplitParty, "sharePct">[]): boolean {
  return (
    parties.length >= 2 &&
    parties.every((p) => Number.isFinite(p.sharePct) && p.sharePct >= 0) &&
    Math.abs(shareTotal(parties) - 100) < SHARE_EPSILON
  );
}

/**
 * Divide a balance into whole-cent portions by percentage. Rounding leftovers
 * go to the largest share so the portions always add back to the balance.
 */
export function allocatePortions(balance: Cents, shares: number[]): Cents[] {
  const total = shares.reduce((a, b) => a + b, 0);
  if (total <= 0) return shares.map(() => 0 as Cents);
  const portions = shares.map((s) => Math.floor((balance * s) / total));
  const remainder = balance - portions.reduce((a, b) => a + b, 0);
  let largest = 0;
  for (let i = 1; i < shares.length; i++) if (shares[i] > shares[largest]) largest = i;
  portions[largest] += remainder;
  return portions as Cents[];
}

interface LedgerParams {
  portion: Cents;
  annualRate: number;
  termYears: number;
  freq: RepaymentFrequency;
  startDate: string;
  offset: Cents;
  extra: Cents;
  lumpSums: SplitLumpSum[];
}

interface Ledger {
  minimum: Cents;
  periods: SplitPartyPeriod[]; // one entry per period until the portion is cleared
  totalInterest: number;
  totalPaid: number;
}

function runLedger({
  portion,
  annualRate,
  termYears,
  freq,
  startDate,
  offset,
  extra,
  lumpSums,
}: LedgerParams): Ledger {
  const ppy = PERIODS_PER_YEAR[freq];
  const maxPeriods = termYears * ppy;
  const rate = annualRate / ppy;
  const minimum = calcMinRepayment(portion, annualRate, termYears, freq);
  const pending = [...lumpSums]
    .filter((l) => l.amount > 0 && /^\d{4}-\d{2}$/.test(l.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  let balance = portion as number;
  let totalInterest = 0;
  let totalPaid = 0;
  const periods: SplitPartyPeriod[] = [];

  for (let p = 0; p < maxPeriods && balance > 0; p++) {
    const date = periodToDate(startDate, p + 1, freq);
    let lump = 0;
    while (pending.length > 0 && pending[0].date <= date) {
      lump += pending.shift()?.amount ?? 0;
    }

    const opening = balance;
    const interest = Math.round(Math.max(0, opening - offset) * rate);
    // The final scheduled payment clears any rounding residue left by the PMT.
    const isFinal = p === maxPeriods - 1;
    const due = isFinal ? opening + interest : minimum + extra + lump;
    const payment = Math.min(opening + interest, due);
    const closing = Math.max(0, opening + interest - payment);

    periods.push({
      opening: opening as Cents,
      interest: interest as Cents,
      payment: payment as Cents,
      extra: Math.max(0, payment - minimum) as Cents,
      closing: closing as Cents,
    });

    totalInterest += interest;
    totalPaid += payment;
    balance = closing;
  }

  return { minimum, periods, totalInterest, totalPaid };
}

const EMPTY_PERIOD: SplitPartyPeriod = {
  opening: 0 as Cents,
  interest: 0 as Cents,
  payment: 0 as Cents,
  extra: 0 as Cents,
  closing: 0 as Cents,
};

export function splitAmortise(input: SplitInput): SplitResult {
  const { currentBalance, interestRate, termYears, repaymentFrequency, startDate, parties } = input;
  const total = shareTotal(parties);
  const valid = sharesAreValid(parties);

  if (!valid) {
    return {
      valid,
      shareTotal: total,
      parties: [],
      rows: [],
      combinedMinimum: 0 as Cents,
      totalInterest: 0 as Cents,
      totalPaid: 0 as Cents,
      payoffPeriods: 0,
      payoffDate: startDate,
    };
  }

  const portions = allocatePortions(
    currentBalance,
    parties.map((p) => p.sharePct),
  );

  const ledgers = parties.map((party, i) => {
    const rate = party.interestRate ?? interestRate;
    const common = {
      portion: portions[i],
      annualRate: rate,
      termYears,
      freq: repaymentFrequency,
      startDate,
    };
    return {
      rate,
      actual: runLedger({
        ...common,
        offset: party.offsetBalance,
        extra: party.extraRepayment,
        lumpSums: party.lumpSums,
      }),
      baseline: runLedger({ ...common, offset: 0 as Cents, extra: 0 as Cents, lumpSums: [] }),
    };
  });

  const payoffPeriods = Math.max(0, ...ledgers.map((l) => l.actual.periods.length));
  const rows: SplitPeriodRow[] = [];
  for (let p = 0; p < payoffPeriods; p++) {
    const periods = ledgers.map((l) => l.actual.periods[p] ?? EMPTY_PERIOD);
    rows.push({
      period: p + 1,
      date: periodToDate(startDate, p + 1, repaymentFrequency),
      parties: periods,
      totalPayment: periods.reduce((s, x) => s + x.payment, 0) as Cents,
      totalInterest: periods.reduce((s, x) => s + x.interest, 0) as Cents,
      totalClosing: periods.reduce((s, x) => s + x.closing, 0) as Cents,
    });
  }

  const totalInterest = ledgers.reduce((s, l) => s + l.actual.totalInterest, 0);
  const totalPaid = ledgers.reduce((s, l) => s + l.actual.totalPaid, 0);
  const proRata = allocatePortions(
    totalInterest as Cents,
    parties.map((p) => p.sharePct),
  );

  const partyResults: SplitPartyResult[] = parties.map((party, i) => {
    const { actual, baseline, rate } = ledgers[i];
    const n = actual.periods.length;
    return {
      id: party.id,
      name: party.name,
      sharePct: party.sharePct,
      portion: portions[i],
      interestRate: rate,
      minimumRepayment: actual.minimum,
      totalInterest: actual.totalInterest as Cents,
      totalPaid: actual.totalPaid as Cents,
      payoffPeriods: n,
      payoffDate: n > 0 ? periodToDate(startDate, n, repaymentFrequency) : startDate,
      baselineInterest: baseline.totalInterest as Cents,
      interestSaved: Math.max(0, baseline.totalInterest - actual.totalInterest) as Cents,
      periodsSaved: Math.max(0, baseline.periods.length - n),
      proRataInterest: proRata[i],
    };
  });

  return {
    valid,
    shareTotal: total,
    parties: partyResults,
    rows,
    combinedMinimum: ledgers.reduce((s, l) => s + l.actual.minimum, 0) as Cents,
    totalInterest: totalInterest as Cents,
    totalPaid: totalPaid as Cents,
    payoffPeriods,
    payoffDate:
      payoffPeriods > 0 ? periodToDate(startDate, payoffPeriods, repaymentFrequency) : startDate,
  };
}

export interface SplitYearRow {
  year: number; // 1-based year of the projection
  date: string; // YYYY-MM of the last period in the year
  parties: { paid: Cents; interest: Cents; closing: Cents }[];
  totalPaid: Cents;
  totalClosing: Cents;
}

/** Roll period rows up into one row per projection year. */
export function splitYearly(result: SplitResult, freq: RepaymentFrequency): SplitYearRow[] {
  const ppy = PERIODS_PER_YEAR[freq];
  const out: SplitYearRow[] = [];
  for (let start = 0; start < result.rows.length; start += ppy) {
    const chunk = result.rows.slice(start, start + ppy);
    const last = chunk[chunk.length - 1];
    const parties = result.parties.map((_, i) => ({
      paid: chunk.reduce((s, r) => s + r.parties[i].payment, 0) as Cents,
      interest: chunk.reduce((s, r) => s + r.parties[i].interest, 0) as Cents,
      closing: last.parties[i].closing,
    }));
    out.push({
      year: start / ppy + 1,
      date: last.date,
      parties,
      totalPaid: parties.reduce((s, p) => s + p.paid, 0) as Cents,
      totalClosing: last.totalClosing,
    });
  }
  return out;
}

/** Default two-way 50/50 split used when the feature is first switched on. */
export function defaultSplitParties(makeId: () => string): SplitParty[] {
  return [
    {
      id: makeId(),
      name: "Party A",
      sharePct: 50,
      extraRepayment: 0 as Cents,
      offsetBalance: 0 as Cents,
      interestRate: null,
      lumpSums: [],
    },
    {
      id: makeId(),
      name: "Party B",
      sharePct: 50,
      extraRepayment: 0 as Cents,
      offsetBalance: 0 as Cents,
      interestRate: null,
      lumpSums: [],
    },
  ];
}
