import {
  type Cents,
  type CoBorrowInput,
  type FortnightlyMethod,
  type Frequency,
  MAX_PARTIES,
} from "@budgy/engine";
import { type BaseLoan, b64urlDecode, b64urlEncode, today } from "./state";

/** One borrower as the person types it, in dollars and percent. */
export interface Borrower {
  id: string;
  name: string;
  sharePct: number;
  deposit: number; // dollars put in up front
  extra?: number; // dollars per repayment
  offset?: number; // dollars in their own offset
  offsetDeposit?: number; // dollars a month into that offset
  lumpSum?: { amount: number; date: string; yearly: boolean };
  frequency?: Frequency; // blank = the loan's
}

export interface SplitLoan {
  balance: number;
  ratePct: number;
  termYears: number;
  frequency: Frequency;
  fortnightlyMethod: FortnightlyMethod;
  startDate: string;
  propertyValue?: number;
}

export interface SplitState {
  loan: SplitLoan;
  borrowers: Borrower[];
}

export function newBorrower(id: string, name: string, sharePct: number): Borrower {
  return { id, name, sharePct, deposit: 0 };
}

export function nextBorrowerId(bs: Borrower[]): string {
  const n = Math.max(0, ...bs.map((b) => Number(b.id.slice(1)) || 0));
  return `p${n + 1}`;
}

export function defaultSplitState(start = today()): SplitState {
  return {
    loan: {
      balance: 600_000,
      ratePct: 6,
      termYears: 30,
      frequency: "monthly",
      fortnightlyMethod: "half-monthly",
      startDate: start,
      propertyValue: 800_000,
    },
    borrowers: [
      { ...newBorrower("p1", "You", 50), deposit: 120_000, extra: 300 },
      { ...newBorrower("p2", "Partner", 50), deposit: 80_000 },
    ],
  };
}

/** Start a split from the mortgage tool's loan, shared evenly by two people. */
export function splitFromBaseLoan(base: BaseLoan): SplitState {
  return {
    loan: {
      balance: base.balance,
      ratePct: base.ratePct,
      termYears: base.termYears,
      frequency: base.frequency,
      fortnightlyMethod: base.fortnightlyMethod,
      startDate: base.startDate,
    },
    borrowers: [
      { ...newBorrower("p1", "Borrower 1", 50), offset: base.offset || undefined },
      newBorrower("p2", "Borrower 2", 50),
    ],
  };
}

const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;
const optCents = (dollars: number | undefined) => (dollars ? toCents(dollars) : undefined);

export function toCoBorrowInput(s: SplitState): CoBorrowInput {
  const { loan } = s;
  return {
    balance: toCents(loan.balance),
    annualRate: loan.ratePct / 100,
    termMonths: Math.round(loan.termYears * 12),
    startDate: loan.startDate,
    frequency: loan.frequency,
    fortnightlyMethod: loan.fortnightlyMethod,
    propertyValue: loan.propertyValue ? toCents(loan.propertyValue) : undefined,
    parties: s.borrowers.map((b) => ({
      id: b.id,
      name: b.name || "Borrower",
      sharePct: b.sharePct,
      deposit: toCents(b.deposit),
      extraPerPeriod: optCents(b.extra),
      offsetBalance: optCents(b.offset),
      offsetMonthlyDeposit: optCents(b.offsetDeposit),
      lumpSums:
        b.lumpSum && b.lumpSum.amount > 0
          ? [
              {
                date: b.lumpSum.date,
                amount: toCents(b.lumpSum.amount),
                repeatYearly: b.lumpSum.yearly,
              },
            ]
          : undefined,
      frequency: b.frequency,
    })),
  };
}

// ── URL state ───────────────────────────────────────────────────────────────

export const SPLIT_URL_VERSION = 1;

const FREQ = { weekly: "w", fortnightly: "f", monthly: "m" } as const;
const FREQ_BACK: Record<string, Frequency> = { w: "weekly", f: "fortnightly", m: "monthly" };
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const optNum = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;

export function encodeSplitState(s: SplitState): string {
  const { loan } = s;
  const compact = {
    l: [
      loan.balance,
      loan.ratePct,
      loan.termYears,
      FREQ[loan.frequency],
      loan.fortnightlyMethod === "true" ? 1 : 0,
      loan.startDate,
      loan.propertyValue,
    ],
    b: s.borrowers.map((b) => ({
      i: b.id,
      n: b.name,
      s: b.sharePct,
      d: b.deposit || undefined,
      x: b.extra,
      o: b.offset,
      m: b.offsetDeposit,
      u: b.lumpSum ? [b.lumpSum.amount, b.lumpSum.date, b.lumpSum.yearly ? 1 : 0] : undefined,
      f: b.frequency ? FREQ[b.frequency] : undefined,
    })),
  };
  return new URLSearchParams({
    v: String(SPLIT_URL_VERSION),
    s: b64urlEncode(JSON.stringify(compact)),
  }).toString();
}

export function decodeSplitState(query: string, fallback = defaultSplitState()): SplitState {
  try {
    const params = new URLSearchParams(query);
    const raw = params.get("s");
    if (!raw || params.get("v") !== String(SPLIT_URL_VERSION)) return fallback;
    const c = JSON.parse(b64urlDecode(raw));
    const l = Array.isArray(c.l) ? c.l : [];
    const fl = fallback.loan;
    const loan: SplitLoan = {
      balance: num(l[0], fl.balance),
      ratePct: num(l[1], fl.ratePct),
      termYears: num(l[2], fl.termYears),
      frequency: FREQ_BACK[l[3]] ?? fl.frequency,
      fortnightlyMethod: l[4] === 1 ? "true" : "half-monthly",
      startDate: isDate(l[5]) ? l[5] : fl.startDate,
      propertyValue: optNum(l[6]),
    };
    const seen = new Set<string>();
    const borrowers: Borrower[] = (Array.isArray(c.b) ? c.b : [])
      .filter((b: unknown) => b && typeof b === "object")
      .slice(0, MAX_PARTIES)
      .map((b: Record<string, unknown>, i: number) => {
        let id = typeof b.i === "string" && /^p\d{1,4}$/.test(b.i) ? b.i : `p${i + 1}`;
        if (seen.has(id)) id = `p${900 + i}`;
        seen.add(id);
        const u = Array.isArray(b.u) ? b.u : null;
        return {
          id,
          name: typeof b.n === "string" ? b.n.slice(0, 40) : `Borrower ${i + 1}`,
          sharePct: Math.min(100, Math.max(0, num(b.s, 0))),
          deposit: optNum(b.d) ?? 0,
          extra: optNum(b.x),
          offset: optNum(b.o),
          offsetDeposit: optNum(b.m),
          lumpSum: u
            ? {
                amount: optNum(u[0]) ?? 0,
                date: isDate(u[1]) ? u[1] : loan.startDate,
                yearly: u[2] === 1,
              }
            : undefined,
          frequency: typeof b.f === "string" ? FREQ_BACK[b.f] : undefined,
        };
      });
    if (borrowers.length < 2) return fallback;
    return { loan, borrowers };
  } catch {
    return fallback;
  }
}
