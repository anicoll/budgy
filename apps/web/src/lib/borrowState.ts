import type { BorrowingInput, Cents, RepaymentFrequency } from "@budgy/engine";
import { financialYear } from "@budgy/engine";
import { b64urlDecode, b64urlEncode, today } from "./state";

/** One person on the loan, as typed, in dollars a year. */
export interface BorrowPerson {
  salary: number;
  overtime?: number;
  bonus?: number;
  rent?: number;
  other?: number;
  help: boolean;
}

export interface BorrowHomeLoan {
  balance: number;
  termYears: number;
}

/** What the person types into the borrowing power tool, in dollars, percent and years. */
export interface BorrowForm {
  people: BorrowPerson[]; // one or two
  dependants: number;
  spending: number; // a month
  cardLimits: number;
  loanRepayments: number; // a month
  loanBalances?: number;
  homeLoans: BorrowHomeLoan[];
  otherCommitments?: number; // a month
  ratePct: number;
  termYears: number;
  deposit?: number;
  /** A repayment the person is comfortable with, per `comfortFreq`. Optional. */
  comfort?: number;
  comfortFreq: RepaymentFrequency;
}

export const COMFORT_FREQS: RepaymentFrequency[] = ["monthly", "fortnightly", "weekly"];
const FREQ_CODE: Record<RepaymentFrequency, string> = {
  monthly: "m",
  fortnightly: "f",
  weekly: "w",
};

export const MAX_HOME_LOANS = 4;

export function defaultBorrow(): BorrowForm {
  return {
    people: [
      { salary: 110_000, overtime: 8_000, help: false },
      { salary: 75_000, help: true },
    ],
    dependants: 1,
    spending: 4_200,
    cardLimits: 10_000,
    loanRepayments: 550,
    loanBalances: 18_000,
    homeLoans: [],
    ratePct: 6,
    termYears: 30,
    deposit: 120_000,
    comfortFreq: "monthly",
  };
}

const toCents = (dollars: number | undefined) =>
  dollars === undefined ? undefined : (Math.round(dollars * 100) as Cents);

export function toBorrowInput(f: BorrowForm, date = today()): BorrowingInput {
  return {
    year: financialYear(date),
    applicants: f.people.map((p) => ({
      salary: toCents(p.salary) as Cents,
      overtime: toCents(p.overtime),
      bonus: toCents(p.bonus),
      rent: toCents(p.rent),
      other: toCents(p.other),
      studyLoan: p.help,
    })),
    dependants: f.dependants,
    livingExpenses: toCents(f.spending) as Cents,
    cardLimits: toCents(f.cardLimits),
    loanRepayments: toCents(f.loanRepayments),
    loanBalances: toCents(f.loanBalances),
    homeLoans: f.homeLoans.map((h) => ({
      balance: toCents(h.balance) as Cents,
      termYears: h.termYears,
    })),
    otherCommitments: toCents(f.otherCommitments),
    rate: f.ratePct / 100,
    termYears: f.termYears,
    deposit: toCents(f.deposit),
  };
}

// ── URL state ───────────────────────────────────────────────────────────────
// Compact JSON in one parameter. Versioned so old links keep working.

export const BORROW_URL_VERSION = 1;

export function encodeBorrow(f: BorrowForm): string {
  const compact = {
    p: f.people.map((p) => [p.salary, p.overtime, p.bonus, p.rent, p.other, p.help ? 1 : 0]),
    d: f.dependants,
    e: f.spending,
    c: f.cardLimits,
    l: f.loanRepayments,
    lb: f.loanBalances,
    h: f.homeLoans.map((h) => [h.balance, h.termYears]),
    o: f.otherCommitments,
    r: f.ratePct,
    t: f.termYears,
    dp: f.deposit,
    cf: f.comfort,
    cq: f.comfort === undefined ? undefined : FREQ_CODE[f.comfortFreq],
  };
  return new URLSearchParams({
    v: String(BORROW_URL_VERSION),
    s: b64urlEncode(JSON.stringify(compact)),
  }).toString();
}

const money = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e9 ? v : fallback;
const optMoney = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e9 ? v : undefined;
const within = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : fallback;

/** Read the form from a query string. Anything missing or broken falls back. */
export function decodeBorrow(query: string, fallback = defaultBorrow()): BorrowForm {
  try {
    const params = new URLSearchParams(query);
    const raw = params.get("s");
    if (!raw || params.get("v") !== String(BORROW_URL_VERSION)) return fallback;
    const c = JSON.parse(b64urlDecode(raw));
    const people: BorrowPerson[] = (Array.isArray(c.p) ? c.p : [])
      .filter(Array.isArray)
      .slice(0, 2)
      .map((p: unknown[]) => ({
        salary: money(p[0], 0),
        overtime: optMoney(p[1]),
        bonus: optMoney(p[2]),
        rent: optMoney(p[3]),
        other: optMoney(p[4]),
        help: p[5] === 1,
      }));
    const homeLoans: BorrowHomeLoan[] = (Array.isArray(c.h) ? c.h : [])
      .filter(Array.isArray)
      .slice(0, MAX_HOME_LOANS)
      .map((h: unknown[]) => ({ balance: money(h[0], 0), termYears: within(h[1], 1, 40, 25) }));
    return {
      people: people.length ? people : fallback.people,
      dependants: Math.round(within(c.d, 0, 10, fallback.dependants)),
      spending: money(c.e, fallback.spending),
      cardLimits: money(c.c, 0),
      loanRepayments: money(c.l, 0),
      loanBalances: optMoney(c.lb),
      homeLoans,
      otherCommitments: optMoney(c.o),
      ratePct: within(c.r, 0, 29, fallback.ratePct),
      termYears: within(c.t, 1, 40, fallback.termYears),
      deposit: optMoney(c.dp),
      comfort: optMoney(c.cf),
      comfortFreq: COMFORT_FREQS.find((q) => FREQ_CODE[q] === c.cq) ?? "monthly",
    };
  } catch {
    return fallback;
  }
}
