import {
  type CarKind,
  type Cents,
  financialYear,
  type NovatedLeaseInput,
  type PayInput,
} from "@budgy/engine";
import { decodePayState, toPayInput } from "./payState";
import { b64urlDecode, b64urlEncode, today } from "./state";

export type LeasePer = "weekly" | "fortnightly" | "monthly";

/** The novated lease calculator's inputs as typed, in dollars and percent. */
export interface LeaseState {
  salary: number; // a year, before tax, without super
  year: string; // tax year, "2026-27"
  studyLoan: boolean;
  hospitalCover: boolean;
  car: CarKind;
  price: number;
  onRoads: number;
  start: string; // ISO date
  termYears: number;
  ratePct: number;
  residualPct?: number; // blank = the ATO minimum
  fee: number; // management fee: a year with GST, or a month without (quote amounts)
  establishmentFee: number; // one-off
  financedFees: number; // PPSR, brokerage: added to the amount financed
  otherMonthly: number; // other provider charges a month, such as a luxury car charge
  inAdvance: boolean; // rentals at the start of each month
  /** Running costs and fees typed as a quote shows them: a month, without GST. */
  quoteAmounts: boolean;
  energy: number;
  rego: number;
  insurance: number;
  servicing: number; // servicing and tyres
  loanPct?: number; // blank = no loan comparison
  savingsPct: number;
  show: LeasePer;
  /** Quote check. */
  quoteFinanced?: number;
  quoteResidual?: number;
  quoteRental?: number;
}

export const LEASE_YEARS = ["2025-26", "2026-27", "2027-28"];

export function defaultLeaseState(on = today()): LeaseState {
  const fy = financialYear(on);
  return {
    salary: 100_000,
    year: LEASE_YEARS.includes(fy) ? fy : "2026-27",
    studyLoan: false,
    hospitalCover: true,
    car: "ev",
    price: 60_000,
    onRoads: 3_000,
    start: on,
    termYears: 3,
    ratePct: 7.5,
    fee: 500,
    establishmentFee: 0,
    financedFees: 0,
    otherMonthly: 0,
    inAdvance: false,
    quoteAmounts: false,
    energy: 800,
    rego: 900,
    insurance: 1_500,
    servicing: 700,
    loanPct: 8.5,
    savingsPct: 4.5,
    show: "fortnightly",
  };
}

/**
 * A first visit starts from what the pay calculator has saved, so the salary,
 * HELP and hospital cover match. Only used when the lease has nothing saved.
 */
export function leaseStateFromPay(payQuery: string | null, on = today()): LeaseState {
  const d = defaultLeaseState(on);
  if (!payQuery) return d;
  const pay = decodePayState(payQuery);
  const input = toPayInput(pay);
  return {
    ...d,
    salary: Math.round(input.salary / 100),
    year: LEASE_YEARS.includes(pay.year) ? pay.year : d.year,
    studyLoan: pay.studyLoan,
    hospitalCover: pay.hospitalCover,
  };
}

const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;

export function toPayFromLease(s: LeaseState): PayInput {
  return {
    year: s.year,
    salary: toCents(s.salary),
    studyLoan: s.studyLoan,
    hospitalCover: s.hospitalCover,
  };
}

/**
 * Switch running costs and the management fee between a year with GST and a
 * month without GST (registration has none), keeping what they cost.
 */
export function switchQuoteAmounts(s: LeaseState, quoteAmounts: boolean): LeaseState {
  if (s.quoteAmounts === quoteAmounts) return s;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const gst = (v: number) => r2(quoteAmounts ? v / 1.1 / 12 : v * 1.1 * 12);
  const plain = (v: number) => r2(quoteAmounts ? v / 12 : v * 12);
  return {
    ...s,
    quoteAmounts,
    fee: gst(s.fee),
    energy: gst(s.energy),
    rego: plain(s.rego),
    insurance: gst(s.insurance),
    servicing: gst(s.servicing),
  };
}

export function toLeaseInput(s: LeaseState, termYears = s.termYears): NovatedLeaseInput {
  // Quote amounts are a month; the engine wants a year.
  const yr = (v: number) => toCents(s.quoteAmounts ? v * 12 : v);
  return {
    pay: toPayFromLease(s),
    car: s.car,
    price: toCents(s.price),
    onRoadCosts: toCents(s.onRoads),
    start: s.start,
    termYears,
    rate: s.ratePct / 100,
    residualRate: s.residualPct === undefined ? undefined : s.residualPct / 100,
    managementFee: yr(s.fee),
    establishmentFee: toCents(s.establishmentFee),
    financedFees: toCents(s.financedFees),
    otherCharges: toCents(s.otherMonthly * 12),
    amountsExGst: s.quoteAmounts,
    inAdvance: s.inAdvance,
    running: {
      energy: yr(s.energy),
      registration: yr(s.rego),
      insurance: yr(s.insurance),
      tyres: 0 as Cents,
      maintenance: yr(s.servicing),
    },
    loanRate: s.loanPct === undefined ? undefined : s.loanPct / 100,
    savingsRate: s.savingsPct / 100,
  };
}

// ── URL state ───────────────────────────────────────────────────────────────

export const LEASE_URL_VERSION = 1;

const CARS: CarKind[] = ["ev", "phev", "ice"];
const SHOWS: LeasePer[] = ["weekly", "fortnightly", "monthly"];

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const money = (v: unknown, fallback: number) => clamp(num(v, fallback), 0, 10_000_000);
const optional = (v: unknown, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : undefined;
const isDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export function encodeLeaseState(s: LeaseState): string {
  const compact = {
    p: [s.salary, s.year, s.studyLoan ? 1 : 0, s.hospitalCover ? 1 : 0],
    c: [CARS.indexOf(s.car), s.price, s.onRoads, s.start],
    l: [s.termYears, s.ratePct, s.residualPct ?? null, s.fee],
    r: [s.energy, s.rego, s.insurance, s.servicing],
    x: [s.loanPct ?? null, s.savingsPct, SHOWS.indexOf(s.show)],
    q: [s.quoteFinanced ?? null, s.quoteResidual ?? null, s.quoteRental ?? null],
    k: [
      s.establishmentFee,
      s.financedFees,
      s.otherMonthly,
      s.inAdvance ? 1 : 0,
      s.quoteAmounts ? 1 : 0,
    ],
  };
  return new URLSearchParams({
    v: String(LEASE_URL_VERSION),
    n: b64urlEncode(JSON.stringify(compact)),
  }).toString();
}

export function decodeLeaseState(query: string, fallback = defaultLeaseState()): LeaseState {
  try {
    const params = new URLSearchParams(query);
    const raw = params.get("n");
    if (!raw || params.get("v") !== String(LEASE_URL_VERSION)) return fallback;
    const o = JSON.parse(b64urlDecode(raw));
    const arr = (v: unknown) => (Array.isArray(v) ? v : []);
    const [p, c, l, r, x, q, k] = [o.p, o.c, o.l, o.r, o.x, o.q, o.k].map(arr);
    return {
      salary: money(p[0], fallback.salary),
      year: LEASE_YEARS.includes(p[1]) ? p[1] : fallback.year,
      studyLoan: p[2] === 1,
      hospitalCover: p[3] !== 0,
      car: CARS[num(c[0], -1)] ?? fallback.car,
      price: clamp(num(c[1], fallback.price), 1, 1_000_000),
      onRoads: clamp(num(c[2], fallback.onRoads), 0, 1_000_000),
      start: isDate(c[3]) ? c[3] : fallback.start,
      termYears: clamp(Math.round(num(l[0], fallback.termYears)), 1, 5),
      ratePct: clamp(num(l[1], fallback.ratePct), 0, 30),
      residualPct: optional(l[2], 0, 99),
      fee: money(l[3], fallback.fee),
      establishmentFee: money(k[0], 0),
      financedFees: money(k[1], 0),
      otherMonthly: money(k[2], 0),
      inAdvance: k[3] === 1,
      quoteAmounts: k[4] === 1,
      energy: money(r[0], fallback.energy),
      rego: money(r[1], fallback.rego),
      insurance: money(r[2], fallback.insurance),
      servicing: money(r[3], fallback.servicing),
      loanPct: optional(x[0], 0, 30),
      savingsPct: clamp(num(x[1], fallback.savingsPct), 0, 30),
      show: SHOWS[num(x[2], -1)] ?? fallback.show,
      quoteFinanced: optional(q[0], 0, 1_000_000),
      quoteResidual: optional(q[1], 0, 1_000_000),
      quoteRental: optional(q[2], 0, 1_000_000),
    };
  } catch {
    return fallback;
  }
}
