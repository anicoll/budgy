import type { Cents } from "../money/cents";
import { calcMinRepayment, PERIODS_PER_YEAR, periodToDate } from "./amortise";
import type { RepaymentFrequency, SplitLumpSum, SplitParty } from "./types";

/**
 * Split-loan modelling.
 *
 * A jointly held loan is divided into portions, one per party. Each portion is
 * tracked as its own ledger:
 *
 * - interest is charged only on that party's outstanding portion (less their own offset),
 * - each party's minimum repayment is the PMT of their portion over the loan term at
 *   their own repayment frequency, so together they cover the whole loan,
 * - extra repayments and lump sums only reduce the portion of the party who made them.
 *
 * Because the ledgers are independent, each party can repay on their own cadence
 * (weekly, fortnightly or monthly). A party who pays faster clears their portion
 * sooner and stops being charged interest on it, while the others carry on.
 */

/** Tolerance for share percentages adding up to 100. */
const SHARE_EPSILON = 0.005;

export interface SplitInput {
  currentBalance: Cents;
  interestRate: number;
  termYears: number;
  repaymentFrequency: RepaymentFrequency; // loan default; parties may override
  startDate: string; // YYYY-MM
  parties: SplitParty[];
}

export interface SplitPartyPeriod {
  period: number;
  date: string; // YYYY-MM
  opening: Cents;
  interest: Cents;
  payment: Cents; // total paid this period (interest + principal)
  extra: Cents; // portion of payment above the party's minimum
  closing: Cents;
}

export interface SplitPartyResult {
  id: string;
  name: string;
  sharePct: number;
  portion: Cents; // share of the current balance
  interestRate: number; // effective annual rate for this portion
  repaymentFrequency: RepaymentFrequency; // effective cadence for this portion
  minimumRepayment: Cents; // per period, before extras
  periods: SplitPartyPeriod[];
  totalInterest: Cents;
  totalPaid: Cents;
  payoffPeriods: number;
  payoffYears: number;
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
  /** Sum of every party's minimum, converted to a per-month figure. */
  monthlyMinimum: Cents;
  totalInterest: Cents;
  totalPaid: Cents;
  payoffYears: number;
  payoffDate: string;
}

// ─── shares ──────────────────────────────────────────────────────────────────

function round2(n: number) {
  return Math.round(n * 100) / 100;
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

/** Spread 100% evenly; the last entry absorbs rounding so the total is exact. */
export function evenShares(n: number): number[] {
  if (n <= 0) return [];
  const each = Math.floor((100 / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? round2(100 - each * (n - 1)) : each));
}

/**
 * Spread `total` percent across `weights` proportionally (evenly if all weights
 * are zero) to 2 decimal places. Uses largest-remainder rounding so the parts
 * stay as close as possible to their exact values and always sum to `total`.
 */
function spread(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const units = Math.round(total * 100); // work in hundredths of a percent
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  const exact =
    sum > 0
      ? weights.map((w) => (Math.max(0, w) / sum) * units)
      : weights.map(() => units / weights.length);
  const floors = exact.map(Math.floor);
  let left = units - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((x, y) => y.frac - x.frac || x.i - y.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors.map((u) => u / 100);
}

/**
 * Set one party's share and rebalance everyone else so the total stays at 100%.
 * The remaining percentage is shared among the other parties in proportion to
 * their current shares (evenly if they are all at zero).
 */
export function setShare<T extends Pick<SplitParty, "id" | "sharePct">>(
  parties: T[],
  id: string,
  pct: number,
): T[] {
  const target = Math.min(100, Math.max(0, round2(pct)));
  const others = parties.filter((p) => p.id !== id);
  if (others.length === parties.length) return parties;
  const spreadOthers = spread(
    round2(100 - target),
    others.map((p) => p.sharePct),
  );
  let j = 0;
  return parties.map((p) =>
    p.id === id ? { ...p, sharePct: target } : { ...p, sharePct: spreadOthers[j++] },
  );
}

/** Remove a party and hand its share to the rest, in proportion to their shares. */
export function removeParty<T extends Pick<SplitParty, "id" | "sharePct">>(
  parties: T[],
  id: string,
): T[] {
  const rest = parties.filter((p) => p.id !== id);
  const shares = spread(
    100,
    rest.map((p) => p.sharePct),
  );
  return rest.map((p, i) => ({ ...p, sharePct: shares[i] }));
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

// ─── ledgers ─────────────────────────────────────────────────────────────────

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
      period: p + 1,
      date,
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

export function effectiveFrequency(
  party: Pick<SplitParty, "repaymentFrequency">,
  loanFreq: RepaymentFrequency,
): RepaymentFrequency {
  return party.repaymentFrequency ?? loanFreq;
}

export function splitAmortise(input: SplitInput): SplitResult {
  const { currentBalance, interestRate, termYears, repaymentFrequency, startDate, parties } = input;
  const total = shareTotal(parties);
  const valid = sharesAreValid(parties);

  if (!valid) {
    return {
      valid,
      shareTotal: total,
      parties: [],
      monthlyMinimum: 0 as Cents,
      totalInterest: 0 as Cents,
      totalPaid: 0 as Cents,
      payoffYears: 0,
      payoffDate: startDate,
    };
  }

  const portions = allocatePortions(
    currentBalance,
    parties.map((p) => p.sharePct),
  );

  const ledgers = parties.map((party, i) => {
    const rate = party.interestRate ?? interestRate;
    const freq = effectiveFrequency(party, repaymentFrequency);
    const common = { portion: portions[i], annualRate: rate, termYears, freq, startDate };
    return {
      rate,
      freq,
      actual: runLedger({
        ...common,
        offset: party.offsetBalance,
        extra: party.extraRepayment,
        lumpSums: party.lumpSums,
      }),
      baseline: runLedger({ ...common, offset: 0 as Cents, extra: 0 as Cents, lumpSums: [] }),
    };
  });

  const totalInterest = ledgers.reduce((s, l) => s + l.actual.totalInterest, 0);
  const totalPaid = ledgers.reduce((s, l) => s + l.actual.totalPaid, 0);
  const proRata = allocatePortions(
    totalInterest as Cents,
    parties.map((p) => p.sharePct),
  );

  const partyResults: SplitPartyResult[] = parties.map((party, i) => {
    const { actual, baseline, rate, freq } = ledgers[i];
    const n = actual.periods.length;
    return {
      id: party.id,
      name: party.name,
      sharePct: party.sharePct,
      portion: portions[i],
      interestRate: rate,
      repaymentFrequency: freq,
      minimumRepayment: actual.minimum,
      periods: actual.periods,
      totalInterest: actual.totalInterest as Cents,
      totalPaid: actual.totalPaid as Cents,
      payoffPeriods: n,
      payoffYears: Math.round((n / PERIODS_PER_YEAR[freq]) * 10) / 10,
      payoffDate: n > 0 ? actual.periods[n - 1].date : startDate,
      baselineInterest: baseline.totalInterest as Cents,
      interestSaved: Math.max(0, baseline.totalInterest - actual.totalInterest) as Cents,
      periodsSaved: Math.max(0, baseline.periods.length - n),
      proRataInterest: proRata[i],
    };
  });

  const last = partyResults.reduce((a, b) => (b.payoffDate > a.payoffDate ? b : a));

  return {
    valid,
    shareTotal: total,
    parties: partyResults,
    monthlyMinimum: Math.round(
      ledgers.reduce((s, l) => s + (l.actual.minimum * PERIODS_PER_YEAR[l.freq]) / 12, 0),
    ) as Cents,
    totalInterest: totalInterest as Cents,
    totalPaid: totalPaid as Cents,
    payoffYears: Math.max(...partyResults.map((p) => p.payoffYears)),
    payoffDate: last.payoffDate,
  };
}

// ─── yearly roll-up ──────────────────────────────────────────────────────────

export interface SplitYearRow {
  year: number; // 1-based year of the projection
  date: string; // YYYY-MM at the end of the year
  parties: { paid: Cents; interest: Cents; closing: Cents }[];
  totalPaid: Cents;
  totalClosing: Cents;
}

/**
 * Roll each party's periods up into projection years. Parties can repay on
 * different cadences, so each is chunked by its own periods-per-year.
 */
export function splitYearly(result: SplitResult, startDate: string): SplitYearRow[] {
  const yearCount = Math.max(
    0,
    ...result.parties.map((p) =>
      Math.ceil(p.payoffPeriods / PERIODS_PER_YEAR[p.repaymentFrequency]),
    ),
  );
  const out: SplitYearRow[] = [];
  for (let y = 0; y < yearCount; y++) {
    const parties = result.parties.map((p) => {
      const ppy = PERIODS_PER_YEAR[p.repaymentFrequency];
      const chunk = p.periods.slice(y * ppy, (y + 1) * ppy);
      const last = chunk[chunk.length - 1];
      return {
        paid: chunk.reduce((s, r) => s + r.payment, 0) as Cents,
        interest: chunk.reduce((s, r) => s + r.interest, 0) as Cents,
        closing: (last?.closing ?? 0) as Cents,
      };
    });
    out.push({
      year: y + 1,
      date: periodToDate(startDate, (y + 1) * 12, "monthly"),
      parties,
      totalPaid: parties.reduce((s, p) => s + p.paid, 0) as Cents,
      totalClosing: parties.reduce((s, p) => s + p.closing, 0) as Cents,
    });
  }
  return out;
}

/** Default two-way 50/50 split used when the feature is first switched on. */
export function defaultSplitParties(makeId: () => string): SplitParty[] {
  return ["Party A", "Party B"].map((name) => ({
    id: makeId(),
    name,
    sharePct: 50,
    extraRepayment: 0 as Cents,
    offsetBalance: 0 as Cents,
    interestRate: null,
    repaymentFrequency: null,
    lumpSums: [],
  }));
}
